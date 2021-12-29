import { InjectorInquirerContext } from '@di/core/inquirer-context';
import { Reflector } from '@di/core/reflector';
import { W_BINDING_DEF, W_PROV, ɵHasProv } from '@di/fields';
import { BeforeResolution } from '@di/hooks';
import {
  ClassProvider,
  CustomProvider,
  FactoryProvider,
  InjectableDef,
  InjectionToken,
  InjectorLifetime,
  Providable,
  ProvidedInScope,
  resolveForwardRef,
  UseExistingProvider,
  ValueProvider,
  ɵdefineInjectable,
} from '@di/providers';
import { Type } from '@di/types';
import { resolveAsyncValue } from '@di/utils';
import { isEmpty, isFunction, isNil } from '@di/utils/common';
import { Observable } from 'rxjs';

import type {
  Injector,
  InjectorGetResult,
  ProviderResolvable,
} from "./injector";
export type NewableTo<T = any, D extends Array<any> = any[]> = new (
  ...args: D
) => T;
export type FactoryFn<T = any, D extends Array<any> = any[]> = (
  ...args: D
) => T;
export type FactoryFnWithoutDeps<T = any> = () => T;

const SINGLETON_BINDING_CONTEXT: Injector = <any>{};

/**
 * A binding represents a provider
 * in a given module context.
 *
 * The `Binding` wrapper for a provider
 * stores additional information about the
 * binding which can be reused if a module
 * provider is used in another injector
 * context (By exporting it from the module).
 */
export class Binding<
  Token extends Providable = any,
  Deps extends Providable[] = any[],
  InstanceType extends any = InjectorGetResult<Token>,
  Factory extends (...deps: Deps) => InstanceType = any
> {
  /** The type this binding represents */
  public metatype: ProviderResolvable;

  /** The token with which the binding can be resolved */
  public readonly token: Providable;

  public get name() {
    return this.token.name;
  }

  /**
   * If the binding has any dependencies,
   * this property contains all the tokens
   * that should be injected as an argument
   * to resolve the factory function.
   *
   * [SomeService, SomeContextProperty]
   */
  public deps: Deps | null;

  public multi: boolean = false;
  /**
   * Whether the binding has any
   * dependencies.
   */
  private _isTreeStatic: boolean | null = null;
  private _isTransientByDependency: boolean | null = null;

  /**
   * If the provider is a singleton,
   * the instance type is stored in
   * this property of the binding.
   *
   * @key The context injector for which
   * the instance was created
   * @value The instance value
   */
  private _instances = new WeakMap<
    Injector,
    InstanceType | InstanceType[] | null
  >();

  /** {@link  InjectorLifetime} */
  public readonly lifetime: InjectorLifetime;
  /** {@link ProvidedInScope} */
  public readonly scope: ProvidedInScope;

  constructor(
    token: Token,
    lifetime: InjectorLifetime,
    scope: ProvidedInScope,
    factory?: Factory
  ) {
    this.token = token;
    this.lifetime = lifetime;
    this.scope = scope;

    this.factory = factory! ?? undefined;
  }

  public isTransient(): boolean {
    return (
      !!(this.lifetime & InjectorLifetime.Transient) ||
      this.isTransientByDependency()
    );
  }

  public isTransientByDependency(): boolean {
    if (!isNil(this._isTransientByDependency)) {
      return this._isTransientByDependency;
    }

    const lifetime = findMostTransientDependencyLifetime(this.deps ?? []);

    if (lifetime & InjectorLifetime.Transient) {
      return (this._isTransientByDependency = true);
    }

    return (this._isTransientByDependency = false);
  }

  public getInstance(
    ctx?: Injector | null
  ): InstanceType | InstanceType[] | null {
    ctx ??= SINGLETON_BINDING_CONTEXT;
    return this._instances.get(ctx) ?? null;
  }

  public setInstance(instance: InstanceType, ctx?: Injector | null): void {
    // Handle `null` case.
    ctx ??= SINGLETON_BINDING_CONTEXT;
    this._instances.set(ctx, instance);
  }

  /**
   * Whether the binding has any
   * dependencies that might change
   * depending on the context the
   * binding is created in.
   */
  public isDependencyTreeStatic(): boolean {
    if (!isNil(this._isTreeStatic)) {
      return this._isTreeStatic;
    }

    if (!this.hasDependencies()) {
      return (this._isTreeStatic = true);
    }

    const lifetime = findMostTransientDependencyLifetime(this.deps ?? []);
    const isTreeStatic = !(
      lifetime &
      (InjectorLifetime.Event | InjectorLifetime.Transient)
    );

    this._isTreeStatic = isTreeStatic;
    return isTreeStatic;
  }

  public hasStaticInstance(): boolean {
    return this.isDependencyTreeStatic() && !isNil(this.getInstance());
  }

  public hasDependencies(): boolean {
    return !isNil(this.deps) && !isEmpty(this.deps);
  }

  public callBeforeResolutionHook(
    injector: Injector,
    deps: Deps,
    inquirerContext: InjectorInquirerContext
  ): Deps | Promise<Deps> {
    if (isNil(this.beforeResolutionHook)) {
      return deps;
    }

    return resolveAsyncValue(
      this.beforeResolutionHook(injector, deps, inquirerContext)
    );
  }

  /**
   * Internal factory function that will
   * be called by the injector to create a
   * new instance of the provider.
   */
  public factory!: (
    ...deps: Deps
  ) => Observable<InstanceType> | Promise<InstanceType> | InstanceType;

  public beforeResolutionHook?: BeforeResolution<any>["beforeResolution"];
}

export function isCustomProvider(provider: any): provider is CustomProvider {
  return provider && "provide" in provider;
}

export function isUseExistingProvider(
  provider: CustomProvider
): provider is UseExistingProvider {
  return provider && "useExisting" in provider;
}

export function isClassProvider(
  provider: CustomProvider
): provider is ClassProvider {
  return provider && "useClass" in provider;
}

export function isFactoryProvider(
  provider: CustomProvider
): provider is FactoryProvider {
  return provider && "useFactory" in provider;
}

export function isValueProvider(
  provider: CustomProvider
): provider is ValueProvider {
  return provider && "useValue" in provider;
}

export function getProviderToken(
  provider: ProviderResolvable
): Type | InjectionToken {
  if (isCustomProvider(provider)) {
    return resolveForwardRef(provider.provide);
  }

  return resolveForwardRef(provider);
}

/**
 * Same as `getInjectableDef` but can return
 * `null` if there is no injectable definition
 * set.
 */
export function getUnsafeInjectableDef(
  typeOrProvider: ProviderResolvable | Providable
): InjectableDef | null {
  if (isNil(typeOrProvider)) {
    throw "Can't get injectable definition of null or undefined";
  }

  let typeOrToken: Type | InjectionToken = typeOrProvider as Type;

  if (isCustomProvider(typeOrProvider)) {
    const { provide } = typeOrProvider;
    typeOrToken = provide;
  }

  return (<ɵHasProv>(<any>typeOrToken))[W_PROV] ?? null;
}

export function getInjectableDef(
  typeOrProvider: ProviderResolvable | Providable
): InjectableDef {
  let injectableDef = getUnsafeInjectableDef(typeOrProvider);
  let typeOrToken = typeOrProvider;

  if (!isNil(injectableDef)) {
    return injectableDef;
  }

  if (isCustomProvider(typeOrProvider)) {
    const { provide } = typeOrProvider;
    typeOrToken = provide;
  }

  return ɵdefineInjectable(typeOrToken);
}

/**
 * Takes an array of provider dependencies and checks whether
 * constructing the provider with those dependencies will
 * ever yield different results depending on the context.
 */
export function findMostTransientDependencyLifetime(
  deps: Providable[]
): InjectorLifetime {
  let providerLifetime = InjectorLifetime.Singleton;

  for (let i = 0; i < deps!.length; i++) {
    const dep = deps![i];
    const { lifetime, providedIn } = getInjectableDef(dep);

    if (lifetime & InjectorLifetime.Transient) {
      /**
       * If a dependency is transient the
       * whole provider is automatically
       * marked transient as well.
       */
      return InjectorLifetime.Transient;
    }

    if (lifetime & InjectorLifetime.Event || providedIn === "ctx") {
      providerLifetime = InjectorLifetime.Event;
    }
  }

  return providerLifetime;
}

/**
 * Creates a `useValue` binding which
 * maps the provider token `provide` with
 * the resolved value in the value provider.
 */
export function createResolvedBinding(_provider: ValueProvider): Binding {
  const provider = resolveForwardRef(_provider);
  const { provide, useValue, multi } = provider;
  const { lifetime, providedIn } = getInjectableDef(provider);

  const binding = new Binding(provide, lifetime, providedIn, () => useValue);

  binding.metatype = provider;
  binding.multi = multi ?? false;

  return binding;
}

/**
 * Creates a new binding using `_provider`.
 * Resolves a forwardRef if there is one and
 * figures out the actual type from a custom
 * provider as well as it's providedIn scope
 * and lifetime.
 */
export function createBinding(_provider: ProviderResolvable): Binding {
  const provider = resolveForwardRef(_provider);
  const { lifetime, providedIn } = getInjectableDef(provider);
  const token = getProviderToken(provider);

  /**
   * For singleton providers we use the binding saved on
   * the provider type such that we always use the same
   * instance even throughout different injectors
   */
  const isSingletonProvider = lifetime & InjectorLifetime.Singleton;

  if (isSingletonProvider && !isNil(token[W_BINDING_DEF])) {
    return token[W_BINDING_DEF];
  }

  if (!isCustomProvider(provider)) {
    const deps = Reflector.reflectCtorArgs(provider);
    const binding = new Binding(provider, lifetime, providedIn);

    const { beforeResolution } =
      (provider.prototype as BeforeResolution<any>) ?? {};

    if (isFunction(beforeResolution)) {
      binding.beforeResolutionHook = beforeResolution;
    }

    binding.metatype = provider;
    binding.deps = deps;
    binding.factory = (...args) => Reflect.construct(provider as Type, args);
    token[W_BINDING_DEF] = binding;
    return binding;
  }

  const { multi } = provider;

  const binding = new Binding(token, lifetime, providedIn);
  token[W_BINDING_DEF] = binding;
  binding.multi = multi ?? false;
  /**
   * UseExisting providers are handled
   * by the injector itself as they
   * point to a different binding.
   */
  if (isClassProvider(provider)) {
    const { useClass, deps } = provider;

    binding.metatype = provider;
    binding.deps = deps ?? Reflector.reflectCtorArgs(useClass) ?? null;
    binding.factory = (...deps) => Reflect.construct(useClass, deps);
  } else if (isFactoryProvider(provider)) {
    const { useFactory, deps } = provider;

    binding.metatype = provider;
    binding.deps = deps ?? null;
    binding.factory = (...deps) => useFactory(...deps);
  } else {
    const { useValue } = provider as ValueProvider;

    binding.metatype = provider;
    binding.factory = () => useValue;
  }

  return binding;
}
