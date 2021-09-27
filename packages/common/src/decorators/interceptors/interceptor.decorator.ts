import { INTERCEPTOR_METADATA } from '@constants';
import { applyStackableMetadata } from '@decorators';
import { ExecutionContext, InjectionToken } from '@interfaces';
import { isMethodDecorator } from '@utils';
import { Observable } from 'rxjs';

export type NextHandler = () => any;

export interface WatsonInterceptor {
  intercept<T>(ctx: ExecutionContext, next: NextHandler): Observable<T>;
}

interface WithIntercept {
  prototype: WatsonInterceptor;
}

export type InterceptorMetadata = WatsonInterceptor | WithIntercept;

export const GLOBAL_INTERCEPTOR = new InjectionToken<InterceptorMetadata[]>(
  "Interceptor that are applied globally"
);

export const INTERCEPTOR = new InjectionToken<InterceptorMetadata[]>(
  "Interceptor for the current module"
);

export function UseInterceptors(
  ...interceptors: InterceptorMetadata[]
): MethodDecorator & ClassDecorator {
  return (
    target: any,
    propertyKey?: string | symbol,
    descriptor?: PropertyDescriptor
  ) => {
    if (isMethodDecorator(descriptor)) {
      return applyStackableMetadata(
        INTERCEPTOR_METADATA,
        descriptor!.value,
        interceptors
      );
    }

    applyStackableMetadata(
      INTERCEPTOR_METADATA,
      target.constructor,
      interceptors
    );
  };
}