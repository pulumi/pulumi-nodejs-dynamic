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
import * as utilities from "./utilities";
import * as provider from "./provider";

const providerCache = new WeakMap<provider.DynamicProvider, Promise<string>>();

function serializeProvider(provider: provider.DynamicProvider): Promise<string> {
  let result: Promise<string>;
  const cachedProvider = providerCache.get(provider);
  if (cachedProvider) {
    result = cachedProvider;
  } else {
    result = pulumi.runtime.serializeFunction(() => provider).then((sf) => sf.text);
    providerCache.set(provider, result);
  }
  return result;
}

/**
 * DynamicResource represents a Pulumi Resource that incorporates an inline implementation of the Resource's
 * CRUD operations.
 */
export abstract class DynamicResource extends pulumi.CustomResource {
  /**
   * Creates a new dynamic resource.
   *
   * @param provider The implementation of the resource's CRUD operations.
   * @param type The type of the resource.
   * @param name The name of the resource.
   * @param props The arguments to use to populate the new resource. Must not define the reserved property "__provider".
   * @param opts A bag of options that control this resource's behavior.
   */
  constructor(
    provider: provider.DynamicProvider,
    type: string,
    name: string,
    props: pulumi.Inputs,
    opts?: pulumi.CustomResourceOptions,
  ) {
    const providerKey: string = "__provider";
    if (props[providerKey]) {
      throw new Error("A dynamic resource must not define the __provider key");
    }
    props[providerKey] = serializeProvider(provider);

    opts = opts || {};
    opts = pulumi.mergeOptions(utilities.resourceOptsDefaults(), opts);

    super("pulumi-nodejs:dynamic:" + type, name, props, opts);
  }
}
