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

/**
 * DynamicProvider represents an object that provides CRUD operations for a particular type of resource.
 */
export interface DynamicProvider {
  // This interface should pretty much be a copy of the pulumi.provider.Provider interface, but with the
  // parts not applicable to dynamic providers striped out (such as version).

  /**
   * Check validates that the given property bag is valid for a resource of the given type.
   *
   * @param olds The old input properties to use for validation.
   * @param news The new input properties to use for validation.
   */
  check?: (olds: any, news: any) => Promise<pulumi.provider.CheckResult>;

  /**
   * Diff checks what impacts a hypothetical update will have on the resource's properties.
   *
   * @param id The ID of the resource to diff.
   * @param olds The old values of properties to diff.
   * @param news The new values of properties to diff.
   */
  diff?: (id: pulumi.ID, olds: any, news: any) => Promise<pulumi.provider.DiffResult>;

  /**
   * Create allocates a new instance of the provided resource and returns its unique ID afterwards.
   * If this call fails, the resource must not have been created (i.e., it is "transactional").
   *
   * @param inputs The properties to set during creation.
   */
  create: (inputs: any) => Promise<pulumi.provider.CreateResult>;

  /**
   * Reads the current live state associated with a resource.  Enough state must be included in the inputs to uniquely
   * identify the resource; this is typically just the resource ID, but it may also include some properties.
   */
  read?: (id: pulumi.ID, props?: any) => Promise<pulumi.provider.ReadResult>;

  /**
   * Update updates an existing resource with new values.
   *
   * @param id The ID of the resource to update.
   * @param olds The old values of properties to update.
   * @param news The new values of properties to update.
   */
  update?: (id: pulumi.ID, olds: any, news: any) => Promise<pulumi.provider.UpdateResult>;

  /**
   * Delete tears down an existing resource with the given ID.  If it fails, the resource is assumed to still exist.
   *
   * @param id The ID of the resource to delete.
   * @param props The current properties on the resource.
   */
  delete?: (id: pulumi.ID, props: any) => Promise<void>;
}
