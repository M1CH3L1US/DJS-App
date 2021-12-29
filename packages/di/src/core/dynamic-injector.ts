import { Binding, createBinding } from '@di/core/binding';
import { ComponentRef } from '@di/core/component-ref';
import { Injector, InjectorGetResult, ProviderResolvable } from '@di/core/injector';
import { InjectorInquirerContext } from '@di/core/inquirer-context';
import { ModuleRef } from '@di/core/module-ref';
import { ɵbindProviders, ɵcreateBindingInstance } from '@di/core/ɵinjector';
import { CustomProvider, ValueProvider } from '@di/providers/custom-provider.interface';
import { getInjectableDef } from '@di/providers/injectable-def';
import { Providable } from '@di/providers/injection-token';
import { Type } from '@di/types';
import { isFunction, isNil } from '@di/utils/common';

import { InjectorBloomFilter } from './injector-bloom-filter';
import { INJECTOR } from './injector-token';

export class DynamicInjector implements Injector {
  public parent: Injector | null;
  protected _bloom: InjectorBloomFilter;
  protected _isComponent: boolean;

  protected readonly _records: Map<Providable, Binding | Binding[]>;

  public get scope(): Type | null {
    return this._scope?.metatype ?? null;
  }
  protected _scope: ModuleRef | null;

  constructor(
    providers: ProviderResolvable[],
    parent: Injector | null,
    scope: ModuleRef | null
  ) {
    this._records = new Map<Providable, Binding | Binding[]>();
    this.parent = parent;
    this._scope = scope;

    // All components and only components
    // provide themselves as a component ref.
    this._isComponent = providers.some(
      (provider) => (<CustomProvider>provider)?.provide === ComponentRef
    );

    if (!isNil(this.scope)) {
      this._records.set(
        ModuleRef,
        createBinding({
          provide: ModuleRef,
          useValue: scope,
        } as ValueProvider)
      );
    }

    this._records.set(
      Injector,
      createBinding({
        provide: Injector,
        useValue: this,
      } as ValueProvider)
    );

    this._records.set(
      INJECTOR,
      createBinding({
        provide: INJECTOR,
        useValue: this,
      } as ValueProvider)
    );

    ɵbindProviders(this, this._records, providers);
  }

  public bind<T extends ProviderResolvable[]>(...providers: T): void {
    ɵbindProviders(this, this._records, providers);
  }

  public async get<T extends Providable, R extends InjectorGetResult<T>>(
    typeOrToken: T,
    notFoundValue?: any,
    ctx: Injector | null = null,
    inquirerContext: InjectorInquirerContext = new InjectorInquirerContext()
  ): Promise<R> {
    const { providedIn } = getInjectableDef(typeOrToken);
    let parent = this.parent ?? Injector.NULL;

    if (providedIn === "ctx") {
      if (isNil(ctx)) {
        throw new Error(
          "[DynamicInjector] Cannot resolve a context bound provider in a dynamic injector"
        );
      }

      return ctx.get(typeOrToken);
    }

    if (
      !this._isComponent &&
      !isNil(this.scope) &&
      (providedIn === "module" ||
        (isFunction(providedIn) && this.scope === providedIn))
    ) {
      parent = Injector.NULL;
    }

    const binding = this._records.get(typeOrToken);

    if (isNil(binding)) {
      if (providedIn === InjectorInquirerContext) {
        return <R>inquirerContext;
      }

      return parent.get(typeOrToken, notFoundValue, ctx, inquirerContext);
    }

    return <R>ɵcreateBindingInstance(binding, this, ctx, inquirerContext);
  }
}
