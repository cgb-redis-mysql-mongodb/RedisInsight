import IORedis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { AppTool, ReplyError, IRedisConsumer } from 'src/models';
import {
  catchRedisConnectionError,
  generateRedisConnectionName,
  getConnectionNamespace,
} from 'src/utils';
import {
  IFindRedisClientInstanceByOptions,
  RedisService,
} from 'src/modules/core/services/redis/redis.service';
import { InstancesBusinessService } from 'src/modules/shared/services/instances-business/instances-business.service';
import { ClientNotFoundErrorException } from 'src/modules/shared/exceptions/client-not-found-error.exception';
import { IRedisToolOptions, DEFAULT_REDIS_TOOL_OPTIONS } from 'src/modules/shared/services/base/redis-tool-options';

export abstract class RedisConsumerAbstractService implements IRedisConsumer {
  protected redisService: RedisService;

  protected instancesBusinessService: InstancesBusinessService;

  protected consumer: AppTool;

  private readonly options: IRedisToolOptions = DEFAULT_REDIS_TOOL_OPTIONS;

  protected constructor(
    consumer: AppTool,
    redisService: RedisService,
    instancesBusinessService: InstancesBusinessService,
    options: IRedisToolOptions = {},
  ) {
    this.consumer = consumer;
    this.options = { ...this.options, ...options };
    this.redisService = redisService;
    this.instancesBusinessService = instancesBusinessService;
  }

  abstract execCommand(
    clientOptions: IFindRedisClientInstanceByOptions,
    toolCommand: any,
    args: Array<string | number | Buffer>,
  ): any;

  abstract execPipeline(
    clientOptions: IFindRedisClientInstanceByOptions,
    toolCommands: Array<[toolCommand: any, ...args: Array<string | number | Buffer>]>,
  ): Promise<[ReplyError | null, any]>;

  private prepareCommands(
    toolCommands: Array<[toolCommand: any, ...args: Array<string | number | Buffer>]>,
  ): string[][] {
    return toolCommands.map((item) => {
      const [toolCommand, ...args] = item;
      const [command, ...commandArgs] = toolCommand.split(' ');
      return [command, ...commandArgs, ...args];
    });
  }

  protected async execPipelineFromClient(
    client,
    toolCommands: Array<
    [toolCommand: any, ...args: Array<string | number | Buffer>]
    >,
  ): Promise<[ReplyError | null, any]> {
    return new Promise((resolve, reject) => {
      try {
        client
          .pipeline(this.prepareCommands(toolCommands))
          .exec((error, result) => {
            resolve([error, result]);
          });
      } catch (e) {
        reject(e);
      }
    });
  }

  protected async execMultiFromClient(
    client,
    toolCommands: Array<
    [toolCommand: any, ...args: Array<string | number | Buffer>]
    >,
  ): Promise<[ReplyError | null, any]> {
    return new Promise((resolve, reject) => {
      try {
        client
          .multi(this.prepareCommands(toolCommands))
          .exec((error, result) => {
            resolve([error, result]);
          });
      } catch (e) {
        reject(e);
      }
    });
  }

  async getRedisClient(
    options: IFindRedisClientInstanceByOptions,
  ): Promise<any> {
    const redisClientInstance = this.redisService.getClientInstance({
      ...options,
      tool: this.consumer,
    });
    if (!redisClientInstance || !this.redisService.isClientConnected(redisClientInstance.client)) {
      this.redisService.removeClientInstance({
        instanceId: redisClientInstance?.instanceId,
        tool: this.consumer,
      });
      if (!this.options.enableAutoConnection) throw new ClientNotFoundErrorException();

      return await this.createNewClient(
        options.instanceId,
        options.uuid,
      );
    }

    return redisClientInstance.client;
  }

  getRedisClientNamespace(options: IFindRedisClientInstanceByOptions): string {
    try {
      const clientInstance = this.redisService.getClientInstance({
        ...options,
        tool: this.consumer,
      });
      return clientInstance?.client ? getConnectionNamespace(clientInstance.client) : '';
    } catch (e) {
      return '';
    }
  }

  protected async createNewClient(
    instanceId: string,
    uuid = uuidv4(),
    namespace?: string,
  ): Promise<IORedis.Redis | IORedis.Cluster> {
    const instanceDto = await this.instancesBusinessService.getOneById(instanceId);
    const connectionName = generateRedisConnectionName(namespace || this.consumer, uuid);
    try {
      const client = await this.redisService.connectToDatabaseInstance(
        instanceDto,
        this.consumer,
        connectionName,
      );
      this.redisService.setClientInstance(
        {
          uuid,
          instanceId,
          tool: this.consumer,
        },
        client,
      );
      return client;
    } catch (error) {
      throw catchRedisConnectionError(error, instanceDto);
    }
  }
}
