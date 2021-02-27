import { WatsonEvent } from '@watsonjs/common';
import { Snowflake } from 'discord.js';

import { DiscordJSAdapter } from './adapters';
import { EventProxy } from './lifecycle/event-proxy';
import { RouteExplorer } from './router';

export interface IApplicationProxyOptions {
  acknowledgementEmote?: Snowflake | string;
}

export class ApplicationProxy {
  private eventProxies = new Map<WatsonEvent, EventProxy<any>>();

  constructor() {}

  public async initAdapter(adapter: DiscordJSAdapter) {
    this.applyProxiesToAdapter(adapter);
  }

  public initFromRouteExplorer(routeExplorer: RouteExplorer) {
    const proxies = routeExplorer.getEventProxiesArray();

    for (const [event, proxy] of proxies) {
      this.bindProxy(event, proxy);
    }
  }

  public bindProxy(event: WatsonEvent, proxy: EventProxy<any>) {
    if (this.eventProxies.has(event)) {
      this.bindToExistingProxy(event, proxy);
    } else {
      this.eventProxies.set(event, proxy);
    }
  }

  public applyProxiesToAdapter(adapter: DiscordJSAdapter) {
    for (const [, proxy] of this.eventProxies) {
      adapter.registerEventProxy(proxy);
    }
  }

  private bindToExistingProxy(event: WatsonEvent, proxy: EventProxy<any>) {
    const handlerFns = proxy.getHandlerFns();
    const proxyRef = this.eventProxies.get(event);

    for (const [eventHandler, exceptionHandler] of handlerFns) {
      proxyRef.bind(eventHandler, exceptionHandler);
    }
  }
}
