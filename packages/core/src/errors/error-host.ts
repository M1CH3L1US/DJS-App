import { BadArgumentException, CommandContextData, EventException, UnatuhorizedException } from '@watson/common';
import { ClientUser, MessageEmbed } from 'discord.js';
import { EventExecutionContext } from 'lifecycle';
import { CommandRoute } from 'routes';

import { BAD_ARGUMENT_ERROR } from './bad-argument.error';
import { UNAUTHORIZED_ERROR } from './unauthorized.error';

export interface IErrorOptions {
  color: string;
  route: CommandRoute;
  clientUser: ClientUser;
}

export class ErrorHost {
  private messageColor: string;

  public configure() {}

  public async handleCommonException(
    exception: EventException,
    ctx: EventExecutionContext<CommandContextData>
  ) {
    let message: MessageEmbed | string;

    if (exception instanceof BadArgumentException) {
      message = BAD_ARGUMENT_ERROR({
        clientUser: ctx.client.user,
        color: this.messageColor,
        param: exception.param,
        route: ctx.getRoute() as CommandRoute,
      });
    } else if (exception instanceof UnatuhorizedException) {
      message = UNAUTHORIZED_ERROR({
        clientUser: ctx.client.user,
        color: this.messageColor,
        route: ctx.getRoute() as CommandRoute,
      });
    }

    const { channel } = ctx.getContextData();
    await channel.send(message);
  }
}