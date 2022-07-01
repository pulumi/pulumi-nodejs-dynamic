// Copyright 2016-2022, Pulumi Corporation.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import * as pulumi from "@pulumi/pulumi";
const requireFromString = require("require-from-string");

const providerKey: string = "__provider";

const providerCache: { [key: string]: pulumi.provider.Provider } = {};

function getProvider(props: any): pulumi.provider.Provider {
  const providerString = props[providerKey];
  let provider: any = providerCache[providerString];
  if (!provider) {
    provider = requireFromString(providerString).handler();
    providerCache[providerString] = provider;
  }

  // TODO[pulumi/pulumi#414]: investigate replacing requireFromString with eval
  return provider;
}

class Provider implements pulumi.provider.Provider {
  constructor(readonly version: string) {}

  async check(urn: string, olds: any, news: any): Promise<pulumi.provider.CheckResult> {
    const provider = getProvider(news[providerKey] === pulumi.runtime.unknownValue ? olds : news);
    if (provider.check === undefined) {
      // If no check method was provided, propagate the new inputs as-is.
      return {
        inputs: news,
        failures: [],
      };
    }
    return provider.check(urn, olds, news);
  }
}

function main(args: string[]) {
  let version: string = require("./package.json").version;
  // Node allows for the version to be prefixed by a "v",
  // while semver doesn't. If there is a v, strip it off.
  if (version.startsWith("v")) {
    version = version.slice(1);
  }
  const provider = new Provider(version);
  return pulumi.provider.main(provider, args);
}

main(process.argv.slice(2));
