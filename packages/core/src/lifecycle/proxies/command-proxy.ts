import { isNil, WatsonEvent } from '@watsonjs/common';
import { Message } from 'discord.js';

import { CommandContainer, CommandMatcher, ParsedCommandData } from '../../command';
import { CommandRoute, LifecycleFunction } from '../../router';
import { ExceptionHandler } from '../exception-handler';
import { EventProxy } from './event-proxy';

export class CommandProxy extends EventProxy<
  WatsonEvent.MESSAGE_CREATE,
  CommandRoute
> {
  private readonly matcher: CommandMatcher;

  constructor(commands: CommandContainer) {
    super(WatsonEvent.MESSAGE_CREATE);

    this.matcher = new CommandMatcher(commands);
  }

  public async proxy<ProxyData extends [Message] = [Message]>(
    event: ProxyData
  ) {
    const [message] = event;
    let routeRef: CommandRoute;
    let parsed: ParsedCommandData;

    /**
     * Matches the message against all mapped
     * command routes.
     * If none could be matched the message will
     * be ignored.
     *
     * If the demand is there to have `command not found`
     * messages this could be updated to specifically
     * catch the `UnknownCommandException`.
     */
    try {
      const { route, command, prefix } = await this.matcher.match(message);

      if (isNil(route)) {
        return;
      }

      routeRef = route;
      parsed = {
        command,
        prefix,
      };
    } catch (err) {
      return;
    }

    const [eventHandler, excpetionHandler] = this.handlers.get(routeRef);

    try {
      await eventHandler(routeRef, event, parsed);
    } catch (err) {
      excpetionHandler.handle(err);
    }
  }

  public bind(
    route: CommandRoute,
    eventHandler: LifecycleFunction,
    exceptionHandler: ExceptionHandler
  ): void {
    this.handlers.set(route, [eventHandler, exceptionHandler]);
  }
}
