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

function resultIncludingProvider(result: any, props: any): any {
  return Object.assign(result || {}, {
    [providerKey]: props[providerKey],
  });
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

  async diff(id: string, urn: string, olds: any, news: any): Promise<pulumi.provider.DiffResult> {
    // Note that we do not take any special action if the provider has changed. This allows a user to iterate on a
    // dynamic provider's implementation. This does require some care on the part of the user: each iteration of a
    // dynamic provider's implementation must be able to handle all state produced by prior iterations.
    //
    // Prior versions of the dynamic provider required that a dynamic resource be replaced any time its provider
    // implementation changed. This made iteration painful, especially if the dynamic resource was managing a
    // physical resource--in this case, the physical resource would be unnecessarily deleted and recreated each
    // time the provider was updated.
    const provider = getProvider(news[providerKey] === pulumi.runtime.unknownValue ? olds : news);
    if (provider.diff === undefined) {
      return {};
    }
    return provider.diff(id, urn, olds, news);
  }

  async create(urn: string, inputs: any): Promise<pulumi.provider.CreateResult> {
    const provider = getProvider(inputs);
    if (provider.create === undefined) {
      throw new Error("Create is not implemented");
    }
    // Ensure to propagate the special __provider value too, so that the provider's CRUD operations continue
    // to function after a refresh.
    const result = await provider.create(urn, inputs);
    return {
      id: result.id,
      outs: resultIncludingProvider(result.outs, inputs),
    };
  }

  async update(
    id: string,
    urn: string,
    olds: any,
    news: any,
  ): Promise<pulumi.provider.UpdateResult> {
    const provider = getProvider(news);
    if (provider.update === undefined) {
      throw new Error("Update is not implemented");
    }
    // Ensure to propagate the special __provider value too, so that the provider's CRUD operations continue
    // to function after a refresh.
    const result = await provider.update(id, urn, olds, news);
    return {
      outs: resultIncludingProvider(result.outs, news),
    };
  }

  async delete(id: string, urn: string, props: any): Promise<void> {
    const provider = getProvider(props);
    // In the event of a missing delete, simply do nothing.
    if (provider.delete !== undefined) {
      return provider.delete(id, urn, props);
    }
  }

  async read(id: string, urn: string, props?: any): Promise<pulumi.provider.ReadResult> {
    const provider = getProvider(props);
    if (provider.read === undefined) {
      // In the event of a missing read, simply return back the input state.
      return {
        id: id,
        props: props,
      };
    }

    // If there's a read function, consult the provider. Ensure to propagate the special __provider value too,
    // so that the provider's CRUD operations continue to function after a refresh.
    const result = await provider.read(id, urn, props);
    return {
      id: result.id,
      props: resultIncludingProvider(result.props, props),
    };
  }
}

function main(args: string[]) {
  let version: string = require("./package.json").version;
  // Node allows for the version to be prefixed by a "v", while semver doesn't. If there is a v, strip it off.
  if (version.startsWith("v")) {
    version = version.slice(1);
  }
  const provider = new Provider(version);
  return pulumi.provider.main(provider, args);
}

main(process.argv.slice(2));
