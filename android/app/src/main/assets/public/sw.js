/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-7e5eb42b'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "index.html",
    "revision": "6ed89f26b8bf868626ecce1447c76189"
  }, {
    "url": "assets/workbox-window.prod.es5-BBnX5xw4.js",
    "revision": null
  }, {
    "url": "assets/web-Uyzuu8YO.js",
    "revision": null
  }, {
    "url": "assets/web-CxhcjJ_K.js",
    "revision": null
  }, {
    "url": "assets/web-CmvmCTLi.js",
    "revision": null
  }, {
    "url": "assets/web-Ck3DltjY.js",
    "revision": null
  }, {
    "url": "assets/web-CZnOjYsd.js",
    "revision": null
  }, {
    "url": "assets/web-CZAsYP6P.js",
    "revision": null
  }, {
    "url": "assets/web-BcyW3upb.js",
    "revision": null
  }, {
    "url": "assets/web-Ba7FgUqK.js",
    "revision": null
  }, {
    "url": "assets/web-BFXcFWoL.js",
    "revision": null
  }, {
    "url": "assets/purify.es-DedTAGkB.js",
    "revision": null
  }, {
    "url": "assets/jspdf.es.min-CSJe8RHa.js",
    "revision": null
  }, {
    "url": "assets/index.es-DYNrQUgZ.js",
    "revision": null
  }, {
    "url": "assets/index-Dnw3h9pE.js",
    "revision": null
  }, {
    "url": "assets/index-DWzfHKaj.js",
    "revision": null
  }, {
    "url": "assets/index-DR3E9pYR.js",
    "revision": null
  }, {
    "url": "assets/index-DIPshwpW.js",
    "revision": null
  }, {
    "url": "assets/index-CmkQzmx2.js",
    "revision": null
  }, {
    "url": "assets/index-CbQGG49T.js",
    "revision": null
  }, {
    "url": "assets/index-BQ1_W6ab.js",
    "revision": null
  }, {
    "url": "assets/index-B3Tt2Do8.js",
    "revision": null
  }, {
    "url": "assets/index-B-rGLbFl.css",
    "revision": null
  }, {
    "url": "assets/html2canvas.esm-QH1iLAAe.js",
    "revision": null
  }, {
    "url": "assets/html2canvas-pro.esm-CjZfrlCd.js",
    "revision": null
  }, {
    "url": "manifest.webmanifest",
    "revision": "72e03719f7b76bf19a0fcbb8ffe5c2b3"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html")));

}));
