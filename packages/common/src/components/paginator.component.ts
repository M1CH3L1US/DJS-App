import { MessageEmbed, MessageReaction } from 'discord.js';

import { CustomComponentException } from '../exceptions/custom-component.exception';
import { isEmpty } from '../utils';
import { IReactiveOptions, WatsonComponent } from './watson-component';

export interface IPaginatorOptions extends IReactiveOptions {
  leftEmote?: string;
  rightEmote?: string;
  deleteEmote?: string;
  delete?: boolean;
}

export class WatsonPaginator extends WatsonComponent<Required<IPaginatorOptions>> {
  public _index: number;
  public paginatorContent: (string | MessageEmbed)[];

  constructor(content: (string | MessageEmbed)[], options: IPaginatorOptions) {
    if (isEmpty(content)) {
      throw new CustomComponentException(
        "The contents of a paginator cannot be an empty array"
      );
    }

    const paginatorOptions = {
      timeReactive: 60000,
      delete: false,
      deleteEmote: "🗑",
      leftEmote: "⬅",
      rightEmote: "➡",
      ...options,
    } 

    const filterFn = (reaction: MessageReaction) =>
      reaction.emoji.name === paginatorOptions.deleteEmote ||
      reaction.emoji.name === paginatorOptions.leftEmote ||
      reaction.emoji.name === paginatorOptions.rightEmote;

    super(content[0], { ...paginatorOptions, reactionsFilter: filterFn });

    this._index = 0;
    this.paginatorContent = content;
  }

  protected async onListenerAttach(): Promise<void> {
    await this.addPaginatorReactions();

    this.onReaction.subscribe(async (reaction) => {
      if (reaction.emoji.name === this.options.leftEmote) {
        await this.paginate("left");
      } else if (reaction.emoji.name === this.options.rightEmote) {
        await this.paginate("right");
      } else if (
        reaction.emoji.name === this.options.deleteEmote &&
        this.options.delete
      ) {
        await this.delete();
      }
    });
  }

  public async paginate(direction: "left" | "right") {
    if (!this.isSent) {
      throw new CustomComponentException(
        "Cannot paginate on a message that was not yet sent"
      );
    }

    const newidx = this.getNextIndex(direction);
    const newContent = this.paginatorContent[newidx];
    await this.update(newContent);
    this._index = newidx;
  }

  private getNextIndex(direction: "left" | "right") {
    if (direction === "left") {
      if (this._index === 0) {
        return this.contentLength;
      } else {
        return this._index - 1;
      }
    } else {
      if (this._index === this.contentLength) {
        return 0;
      } else {
        return this._index + 1;
      }
    }
  }

  private async addPaginatorReactions() {
    await this._messageRef.react(this.options.leftEmote);
    await this._messageRef.react(this.options.rightEmote);

    if (this.options.delete) {
      await this._messageRef.react(this.options.deleteEmote);
    }
  }

  private get contentLength() {
    return this.paginatorContent.length - 1;
  }
}
