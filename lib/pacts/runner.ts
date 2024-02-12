import { C8yPact, C8yPactInfo, C8yPactRecord } from "@shared/c8ypact";

const { _ } = Cypress;

declare global {
  /**
   * Configuration options for C8yPactRunner.
   */
  interface C8yPactRunnerOptions {
    /**
     * Filter for consumer name.
     */
    consumer?: string;
    /**
     * Filter for producer name.
     */
    producer?: string;
  }

  /**
   * Runtime for C8yPact objects. A runner will create the tests dynamically based on
   * the pact objects information and rerun recorded requests.
   */
  interface C8yPactRunner {
    /**
     * Runs all pact objects. Will create the tests dynamically for each pact object.
     *
     * @param pacts Pact objects to run.
     * @param options Runner options.
     */
    run: (pacts: C8yPact[], options?: C8yPactRunnerOptions) => void;

    /**
     * Runs a single pact object. Needs to run within a test-case.
     *
     * @param pact Pact object to run.
     */
    runTest: (pact: C8yPact) => void;
  }
}

type TestHierarchyTree<T> = { [key: string]: T | TestHierarchyTree<T> };

/**
 * Default implementation of C8yPactRunner. Runtime for C8yPact objects that will
 * create the tests dynamically and rerun recorded requests. Supports Basic and Cookie based
 * authentication, id mapping, consumer and producer filtering and URL replacement.
 */
export class C8yDefaultPactRunner implements C8yPactRunner {
  constructor() {}

  protected idMapper: { [key: string]: string } = {};

  run(pacts: C8yPact[], options: C8yPactRunnerOptions = {}): void {
    this.idMapper = {};

    if (!_.isArray(pacts)) return;
    const tests: C8yPact[] = [];

    for (const pact of pacts) {
      const { info, records, id } = pact;
      if (!isPact(pact)) continue;

      if (
        _.isString(options.consumer) &&
        (_.isString(info?.consumer) ? info?.consumer : info?.consumer.name) !==
          options.consumer
      ) {
        continue;
      }

      if (
        _.isString(options.producer) &&
        (_.isString(info?.producer) ? info?.consumer : info?.producer.name) !==
          options.consumer
      ) {
        continue;
      }

      if (!info?.title) {
        info.title = info?.id?.split("__");
      }
      tests.push(pact);
    }

    const testHierarchy = this.buildTestHierarchy(tests);
    this.createTestsFromHierarchy(testHierarchy);
  }

  protected buildTestHierarchy(
    pactObjects: C8yPact[]
  ): TestHierarchyTree<C8yPact> {
    const tree: TestHierarchyTree<C8yPact> = {};
    pactObjects.forEach((pact) => {
      const titles = pact.info.title;

      let currentNode = tree;
      titles.forEach((title, index) => {
        if (!currentNode[title]) {
          currentNode[title] = index === titles.length - 1 ? pact : {};
        }
        currentNode = currentNode[title] as TestHierarchyTree<C8yPact>;
      });
    });
    return tree;
  }

  protected createTestsFromHierarchy(hierarchy: TestHierarchyTree<C8yPact>) {
    const keys = Object.keys(hierarchy);
    keys.forEach((key: string, index: number) => {
      const subTree = hierarchy[key];
      const that = this;

      if (isPact(subTree)) {
        it(key, () => {
          that.runTest(subTree);
        });
      } else {
        context(key, function () {
          that.createTestsFromHierarchy(subTree);
        });
      }
    });
  }

  runTest(pact: C8yPact) {
    Cypress.c8ypact.current = pact;
    this.idMapper = {};

    for (const record of pact?.records) {
      cy.then(() => {
        Cypress.c8ypact.config.strictMatching =
          pact.info?.strictMatching != null ? pact.info.strictMatching : true;

        const url = this.createURL(record, pact.info);
        const clientFetchOptions = this.createFetchOptions(record, pact.info);

        let user = record.auth.userAlias || record.auth.user;
        if (user.split("/").length > 1) {
          user = user.split("/").slice(1).join("/");
        }
        if (url === "/devicecontrol/deviceCredentials") {
          user = "devicebootstrap";
        }

        const cOpts: C8yClientOptions = {
          // pact: { record: record, info: pact.info },
          ..._.pick(record.options, [
            "skipClientAuthentication",
            "preferBasicAuth",
            "failOnStatusCode",
            "timeout",
          ]),
        };

        const responseFn = (response: Cypress.Response<any>) => {
          if (
            url === "/devicecontrol/deviceCredentials" &&
            response.status === 201
          ) {
            const { username, password } = response.body;
            if (username && password) {
              Cypress.env(`${username}_username`, username);
              Cypress.env(`${username}_password`, password);
            }
          }
          // @ts-ignore
          if (response.method === "POST") {
            const newId = response.body.id;
            if (newId) {
              this.idMapper[record.createdObject] = newId;
            }
          }
        };

        if (record.auth && record.auth.type === "CookieAuth") {
          cy.getAuth(user).login();
          cy.c8yclient(
            (c) => c.core.fetch(url, clientFetchOptions),
            cOpts
          ).then(responseFn);
        } else {
          cy.getAuth(user)
            .c8yclient((c) => c.core.fetch(url, clientFetchOptions), cOpts)
            .then(responseFn);
        }
      });
    }
  }

  protected createHeader(pact: C8yPactRecord, info: C8yPactInfo): any {
    let headers = _.omit(pact.request.headers || {}, [
      "X-XSRF-TOKEN",
      "Authorization",
    ]);
    return headers;
  }

  protected createFetchOptions(pact: C8yPactRecord, info: C8yPactInfo): any {
    let options: any = {
      method: pact.request.method || "GET",
      headers: this.createHeader(pact, info),
    };
    let body = pact.request.body;
    if (body) {
      if (_.isString(body)) {
        options.body = this.updateIds(body);
        options.body = this.updateURLs(options.body, info);
      } else if (_.isObject(body)) {
        let b = JSON.stringify(body);
        b = this.updateIds(b);
        b = this.updateURLs(b, info);
        options.body = b;
      }
    }
    return options;
  }

  protected createURL(pact: C8yPactRecord, info: C8yPactInfo): string {
    let url = pact.request.url;
    if (info?.baseUrl && url.includes(info.baseUrl)) {
      url = url.replace(info.baseUrl, "");
    }
    if (url.includes(Cypress.config().baseUrl)) {
      url = url.replace(Cypress.config().baseUrl, "");
    }
    url = this.updateIds(url);
    return url;
  }

  protected updateURLs(value: string, info: C8yPactInfo): string {
    if (!value || !info) return value;
    let result = value;

    const tenantUrl = (baseUrl: string, tenant: string): URL => {
      if (!baseUrl || !tenant) return undefined;
      try {
        const url = new URL(baseUrl);
        const instance = url.host.split(".")?.slice(1)?.join(".");
        url.host = `${tenant}.${instance}`;
        return url;
      } catch {}
      return undefined;
    };

    const infoUrl = tenantUrl(info.baseUrl, info.tenant);
    const url = tenantUrl(Cypress.config().baseUrl, Cypress.env("C8Y_TENANT"));

    if (infoUrl && url) {
      const regexp = new RegExp(`${infoUrl.href}`, "g");
      result = result.replace(regexp, url.href);
    }

    if (Cypress.config().baseUrl && info.baseUrl) {
      const regexp = new RegExp(`${info.baseUrl}`, "g");
      result = result.replace(regexp, Cypress.config().baseUrl);
    }
    if (info.tenant && Cypress.env("C8Y_TENANT")) {
      const regexp = new RegExp(`${info.tenant}`, "g");
      result = result.replace(regexp, Cypress.env("C8Y_TENANT"));
    }
    return result;
  }

  protected updateIds(value: string): string {
    if (!value || !this.idMapper) return value;
    let result = value;
    for (const currentId of Object.keys(this.idMapper)) {
      const regexp = new RegExp(`${currentId}`, "g");
      result = result.replace(regexp, this.idMapper[currentId]);
    }
    return result;
  }
}
