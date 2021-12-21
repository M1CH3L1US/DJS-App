import { INTERCEPTOR_METADATA } from '@common/constants';
import { W_INT_TYPE } from '@common/fields';
import { ExecutionContext } from '@common/pipeline';
import { InjectionToken, InjectorLifetime } from '@watsonjs/di';
import { Observable } from 'rxjs';

import { applyInterceptorMetadata, ɵINTERCEPTOR_TYPE } from './is-interceptor';

export type NextHandler = () => any;

export interface WatsonInterceptor {
  intercept<T>(ctx: ExecutionContext, next: NextHandler): Observable<T>;
}

interface WithIntercept {
  prototype: WatsonInterceptor;
}

export type InterceptorMetadata = WatsonInterceptor | WithIntercept;

export const GLOBAL_INTERCEPTOR = new InjectionToken<InterceptorMetadata[]>(
  "Interceptor that are applied globally",
  { providedIn: "root", lifetime: InjectorLifetime.Event }
);

GLOBAL_INTERCEPTOR[W_INT_TYPE] = ɵINTERCEPTOR_TYPE.Interceptor;

export const INTERCEPTOR = new InjectionToken<InterceptorMetadata[]>(
  "Interceptor for the current module",
  { providedIn: "module", lifetime: InjectorLifetime.Event }
);

INTERCEPTOR[W_INT_TYPE] = ɵINTERCEPTOR_TYPE.Interceptor;

export function UseInterceptors(
  ...interceptors: InterceptorMetadata[]
): MethodDecorator & ClassDecorator {
  return (
    target: any,
    propertyKey?: string | symbol,
    descriptor?: PropertyDescriptor
  ) => {
    return applyInterceptorMetadata(
      ɵINTERCEPTOR_TYPE.Interceptor,
      INTERCEPTOR_METADATA,
      interceptors,
      target,
      descriptor
    );
  };
}
