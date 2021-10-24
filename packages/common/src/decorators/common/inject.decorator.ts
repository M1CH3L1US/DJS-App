import { INJECT_DEPENDENCY_METADATA } from '@common/constants';
import { applyStackableMetadata } from '@common/decorators';
import { InjectionToken } from '@common/di';
import { Type } from '@common/interfaces';

export interface InjectMetadata {
  propertyKey: string | symbol;
  parameterIndex: number;
  provide: Type | InjectionToken;
}

/**
 * Injects a dependency into the argument
 * of a class constructor.
 *
 * Note that this decorator cannot be used
 * in class methods.
 */
export function Inject(token: Type | InjectionToken): ParameterDecorator {
  return (
    target: Object,
    propertyKey: string | symbol,
    parameterIndex: number
  ) => {
    const metadata: InjectMetadata = {
      provide: token,
      propertyKey: propertyKey,
      parameterIndex: parameterIndex,
    };

    applyStackableMetadata(INJECT_DEPENDENCY_METADATA, target.constructor, [
      metadata,
    ]);
  };
}
