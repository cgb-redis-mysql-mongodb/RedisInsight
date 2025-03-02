import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { when } from 'jest-when';
import { SortOrder } from 'src/constants/sort';
import { ReplyError } from 'src/models';
import {
  mockBrowserAnalyticsService,
  mockRedisConsumer,
  mockRedisNoPermError,
  mockRedisWrongTypeError,
  mockStandaloneDatabaseEntity,
} from 'src/__mocks__';
import config from 'src/utils/config';
import {
  AddMembersToZSetDto,
  CreateZSetWithExpireDto,
  DeleteMembersFromZSetDto,
  GetZSetMembersDto,
  SearchZSetMembersDto,
  SearchZSetMembersResponse,
  UpdateMemberInZSetDto,
} from 'src/modules/browser/dto';
import {
  BrowserToolKeysCommands,
  BrowserToolZSetCommands,
} from 'src/modules/browser/constants/browser-tool-commands';
import { IFindRedisClientInstanceByOptions } from 'src/modules/core/services/redis/redis.service';
import { ZSetBusinessService } from './z-set-business.service';
import { BrowserToolService } from '../browser-tool/browser-tool.service';
import { BrowserAnalyticsService } from '../browser-analytics/browser-analytics.service';

const REDIS_SCAN_CONFIG = config.get('redis_scan');

const mockClientOptions: IFindRedisClientInstanceByOptions = {
  instanceId: mockStandaloneDatabaseEntity.id,
};

const mockGetMembersDto: GetZSetMembersDto = {
  keyName: 'zSet',
  offset: 0,
  count: REDIS_SCAN_CONFIG.countDefault || 15,
  sortOrder: SortOrder.Asc,
};

const mockSearchMembersDto: SearchZSetMembersDto = {
  keyName: 'zSet',
  cursor: 0,
  count: 15,
  match: '*',
};

const mockAddMembersDto: AddMembersToZSetDto = {
  keyName: mockGetMembersDto.keyName,
  members: [
    {
      name: 'member1',
      score: 0,
    },
    {
      name: 'member2',
      score: 2,
    },
  ],
};

const mockUpdateMemberDto: UpdateMemberInZSetDto = {
  keyName: mockGetMembersDto.keyName,
  member: mockAddMembersDto.members[0],
};

const mockMembersForZAddCommand = ['0', 'member1', '2', 'member2'];

const mockDeleteMembersDto: DeleteMembersFromZSetDto = {
  keyName: mockAddMembersDto.keyName,
  members: ['member1', 'member2'],
};

const getZSetMembersInAscResponse = {
  keyName: mockGetMembersDto.keyName,
  total: mockAddMembersDto.members.length,
  members: [...mockAddMembersDto.members],
};

const getZSetMembersInDescResponse = {
  keyName: mockGetMembersDto.keyName,
  total: mockAddMembersDto.members.length,
  members: mockAddMembersDto.members.slice().reverse(),
};

const mockSearchZSetMembersResponse: SearchZSetMembersResponse = {
  keyName: mockGetMembersDto.keyName,
  total: mockAddMembersDto.members.length,
  nextCursor: 0,
  members: [...mockAddMembersDto.members],
};

describe('ZSetBusinessService', () => {
  let service: ZSetBusinessService;
  let browserTool;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ZSetBusinessService,
        {
          provide: BrowserAnalyticsService,
          useFactory: mockBrowserAnalyticsService,
        },
        {
          provide: BrowserToolService,
          useFactory: mockRedisConsumer,
        },
      ],
    }).compile();

    service = module.get<ZSetBusinessService>(ZSetBusinessService);
    browserTool = module.get<BrowserToolService>(BrowserToolService);
  });

  describe('createZSet', () => {
    beforeEach(() => {
      when(browserTool.execCommand)
        .calledWith(mockClientOptions, BrowserToolKeysCommands.Exists, [
          mockAddMembersDto.keyName,
        ])
        .mockResolvedValue(0);
      service.createZSetWithExpiration = jest.fn();
    });
    it('create zset with expiration', async () => {
      service.createZSetWithExpiration = jest
        .fn()
        .mockResolvedValue(mockAddMembersDto.members.length);

      await expect(
        service.createZSet(mockClientOptions, {
          ...mockAddMembersDto,
          expire: 1000,
        }),
      ).resolves.not.toThrow();
      expect(service.createZSetWithExpiration).toHaveBeenCalled();
    });
    it('create zset without expiration', async () => {
      const { keyName } = mockAddMembersDto;
      when(browserTool.execCommand)
        .calledWith(mockClientOptions, BrowserToolZSetCommands.ZAdd, [
          keyName,
          ...mockMembersForZAddCommand,
        ])
        .mockResolvedValue(mockAddMembersDto.members.length);

      await expect(
        service.createZSet(mockClientOptions, mockAddMembersDto),
      ).resolves.not.toThrow();
      expect(service.createZSetWithExpiration).not.toHaveBeenCalled();
    });
    it('key with this name exist', async () => {
      when(browserTool.execCommand)
        .calledWith(mockClientOptions, BrowserToolKeysCommands.Exists, [
          mockAddMembersDto.keyName,
        ])
        .mockResolvedValue(1);

      await expect(
        service.createZSet(mockClientOptions, mockAddMembersDto),
      ).rejects.toThrow(ConflictException);
      expect(browserTool.execCommand).toHaveBeenCalledTimes(1);
      expect(browserTool.execMulti).not.toHaveBeenCalled();
    });
    it("try to use 'ZADD' command not for zset data type for createZSet", async () => {
      const replyError: ReplyError = {
        ...mockRedisWrongTypeError,
        command: 'ZADD',
      };
      when(browserTool.execCommand)
        .calledWith(
          mockClientOptions,
          BrowserToolZSetCommands.ZAdd,
          expect.anything(),
        )
        .mockRejectedValue(replyError);

      await expect(
        service.createZSet(mockClientOptions, mockAddMembersDto),
      ).rejects.toThrow(BadRequestException);
    });
    it("user don't have required permissions for createZSet", async () => {
      const replyError: ReplyError = {
        ...mockRedisNoPermError,
        command: 'ZADD',
      };
      browserTool.execCommand.mockRejectedValue(replyError);

      await expect(
        service.createZSet(mockClientOptions, mockAddMembersDto),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('createZSetWithExpiration', () => {
    const dto: CreateZSetWithExpireDto = {
      ...mockAddMembersDto,
      expire: 1000,
    };
    it('succeed to create ZSet data type with expiration', async () => {
      when(browserTool.execMulti)
        .calledWith(mockClientOptions, [
          [
            BrowserToolZSetCommands.ZAdd,
            dto.keyName,
            ...mockMembersForZAddCommand,
          ],
          [BrowserToolKeysCommands.Expire, dto.keyName, dto.expire],
        ])
        .mockResolvedValue([
          null,
          [
            [null, mockAddMembersDto.members.length],
            [null, 1],
          ],
        ]);

      const result = await service.createZSetWithExpiration(
        mockClientOptions,
        dto,
      );
      expect(result).toBe(mockAddMembersDto.members.length);
    });
    it('throw transaction error', async () => {
      const transactionError: ReplyError = {
        ...mockRedisWrongTypeError,
        command: 'ZADD',
      };
      browserTool.execMulti.mockResolvedValue([transactionError, null]);

      await expect(
        service.createZSetWithExpiration(mockClientOptions, dto),
      ).rejects.toEqual(transactionError);
    });
  });

  describe('getMembers', () => {
    beforeEach(() => {
      when(browserTool.execCommand)
        .calledWith(mockClientOptions, BrowserToolZSetCommands.ZCard, [
          mockGetMembersDto.keyName,
        ])
        .mockResolvedValue(mockAddMembersDto.members.length);
    });
    it('get members sorted in asc', async () => {
      when(browserTool.execCommand)
        .calledWith(
          mockClientOptions,
          BrowserToolZSetCommands.ZRange,
          expect.anything(),
        )
        .mockResolvedValue(['member1', '0', 'member2', '2']);

      const result = await service.getMembers(
        mockClientOptions,
        mockGetMembersDto,
      );
      await expect(result).toEqual(getZSetMembersInAscResponse);
    });
    it('get members sorted in desc', async () => {
      when(browserTool.execCommand)
        .calledWith(
          mockClientOptions,
          BrowserToolZSetCommands.ZRevRange,
          expect.anything(),
        )
        .mockResolvedValue(['member2', '2', 'member1', '0']);

      const result = await service.getMembers(mockClientOptions, {
        ...mockGetMembersDto,
        sortOrder: SortOrder.Desc,
      });
      await expect(result).toEqual(getZSetMembersInDescResponse);
    });
    it('key with this name does not exist for getMembers', async () => {
      when(browserTool.execCommand)
        .calledWith(mockClientOptions, BrowserToolZSetCommands.ZCard, [
          mockGetMembersDto.keyName,
        ])
        .mockResolvedValue(0);

      await expect(
        service.getMembers(mockClientOptions, mockGetMembersDto),
      ).rejects.toThrow(NotFoundException);
      expect(browserTool.execCommand).toHaveBeenCalledTimes(1);
    });
    it("try to use 'ZCARD' command not for zset data type", async () => {
      const replyError: ReplyError = {
        ...mockRedisWrongTypeError,
        command: 'ZCARD',
      };
      browserTool.execCommand.mockRejectedValue(replyError);

      await expect(
        service.getMembers(mockClientOptions, mockGetMembersDto),
      ).rejects.toThrow(BadRequestException);
    });
    it("user don't have required permissions for getMembers", async () => {
      const replyError: ReplyError = {
        ...mockRedisNoPermError,
        command: 'ZCARD',
      };
      browserTool.execCommand.mockRejectedValue(replyError);

      await expect(
        service.getMembers(mockClientOptions, mockGetMembersDto),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('addMembers', () => {
    beforeEach(() => {
      when(browserTool.execCommand)
        .calledWith(mockClientOptions, BrowserToolKeysCommands.Exists, [
          mockAddMembersDto.keyName,
        ])
        .mockResolvedValue(1);
    });
    it('succeed to add members to the ZSet data type', async () => {
      const { keyName } = mockAddMembersDto;
      when(browserTool.execCommand)
        .calledWith(mockClientOptions, BrowserToolZSetCommands.ZAdd, [
          keyName,
          ...mockMembersForZAddCommand,
        ])
        .mockResolvedValue(mockAddMembersDto.members.length);

      await expect(
        service.addMembers(mockClientOptions, mockAddMembersDto),
      ).resolves.not.toThrow();
    });
    it('key with this name does not exist for addMembers', async () => {
      const { keyName } = mockAddMembersDto;
      when(browserTool.execCommand)
        .calledWith(mockClientOptions, BrowserToolKeysCommands.Exists, [
          keyName,
        ])
        .mockResolvedValue(0);

      await expect(
        service.addMembers(mockClientOptions, mockAddMembersDto),
      ).rejects.toThrow(NotFoundException);
      expect(browserTool.execCommand).not.toHaveBeenCalledWith(
        mockClientOptions,
        BrowserToolZSetCommands.ZAdd,
        expect.anything(),
      );
    });
    it("try to use 'ZADD' command not for zset data type for addMembers", async () => {
      const replyError: ReplyError = {
        ...mockRedisWrongTypeError,
        command: 'ZADD',
      };
      when(browserTool.execCommand)
        .calledWith(
          mockClientOptions,
          BrowserToolZSetCommands.ZAdd,
          expect.anything(),
        )
        .mockRejectedValue(replyError);

      await expect(
        service.addMembers(mockClientOptions, mockAddMembersDto),
      ).rejects.toThrow(BadRequestException);
    });
    it("user don't have required permissions for addMembers", async () => {
      const replyError: ReplyError = {
        ...mockRedisNoPermError,
        command: 'ZADD',
      };
      browserTool.execCommand.mockRejectedValue(replyError);

      await expect(
        service.addMembers(mockClientOptions, mockAddMembersDto),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateMember', () => {
    beforeEach(() => when(browserTool.execCommand)
      .calledWith(mockClientOptions, BrowserToolKeysCommands.Exists, [
        mockAddMembersDto.keyName,
      ])
      .mockResolvedValue(1));

    it('succeed to update member in key', async () => {
      const { keyName, member } = mockUpdateMemberDto;
      when(browserTool.execCommand)
        .calledWith(mockClientOptions, BrowserToolZSetCommands.ZAdd, [
          keyName,
          'XX',
          'CH',
          `${member.score}`,
          member.name,
        ])
        .mockResolvedValue(1);

      await expect(
        service.updateMember(mockClientOptions, mockUpdateMemberDto),
      ).resolves.not.toThrow();
    });
    it('key with this name does not exist for updateMember', async () => {
      const { keyName } = mockUpdateMemberDto;
      when(browserTool.execCommand)
        .calledWith(mockClientOptions, BrowserToolKeysCommands.Exists, [
          keyName,
        ])
        .mockResolvedValue(0);

      await expect(
        service.updateMember(mockClientOptions, mockUpdateMemberDto),
      ).rejects.toThrow(NotFoundException);
      expect(browserTool.execCommand).not.toHaveBeenCalledWith(
        mockClientOptions,
        BrowserToolZSetCommands.ZAdd,
        expect.anything(),
      );
    });
    it('member does not exist in key', async () => {
      const { keyName, member } = mockUpdateMemberDto;
      when(browserTool.execCommand)
        .calledWith(mockClientOptions, BrowserToolZSetCommands.ZAdd, [
          keyName,
          'XX',
          'CH',
          `${member.score}`,
          member.name,
        ])
        .mockResolvedValue(0);

      await expect(
        service.updateMember(mockClientOptions, mockUpdateMemberDto),
      ).rejects.toThrow(NotFoundException);
    });
    it("try to use 'ZADD' command not for zset data type for updateMember", async () => {
      const replyError: ReplyError = {
        ...mockRedisWrongTypeError,
        command: 'ZADD',
      };
      when(browserTool.execCommand)
        .calledWith(
          mockClientOptions,
          BrowserToolZSetCommands.ZAdd,
          expect.anything(),
        )
        .mockRejectedValue(replyError);

      await expect(
        service.updateMember(mockClientOptions, mockUpdateMemberDto),
      ).rejects.toThrow(BadRequestException);
    });
    it("user don't have required permissions for updateMember", async () => {
      const replyError: ReplyError = {
        ...mockRedisNoPermError,
        command: 'ZADD',
      };
      browserTool.execCommand.mockRejectedValue(replyError);

      await expect(
        service.updateMember(mockClientOptions, mockUpdateMemberDto),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteMembers', () => {
    beforeEach(() => {
      when(browserTool.execCommand)
        .calledWith(mockClientOptions, BrowserToolKeysCommands.Exists, [
          mockDeleteMembersDto.keyName,
        ])
        .mockResolvedValue(1);
    });
    it('succeeded to delete members from ZSet data type', async () => {
      const { members, keyName } = mockDeleteMembersDto;
      when(browserTool.execCommand)
        .calledWith(mockClientOptions, BrowserToolZSetCommands.ZRem, [
          keyName,
          ...members,
        ])
        .mockResolvedValue(members.length);

      const result = await service.deleteMembers(
        mockClientOptions,
        mockDeleteMembersDto,
      );

      expect(result).toEqual({ affected: members.length });
    });
    it('key with this name does not exist for deleteMembers', async () => {
      const { members, keyName } = mockDeleteMembersDto;
      when(browserTool.execCommand)
        .calledWith(mockClientOptions, BrowserToolKeysCommands.Exists, [
          keyName,
        ])
        .mockResolvedValue(0);

      await expect(
        service.deleteMembers(mockClientOptions, mockDeleteMembersDto),
      ).rejects.toThrow(NotFoundException);
      expect(
        browserTool.execCommand,
      ).not.toHaveBeenCalledWith(
        mockClientOptions,
        BrowserToolZSetCommands.ZRem,
        [keyName, ...members],
      );
    });
    it("try to use 'ZREM' command not for set data type", async () => {
      const replyError: ReplyError = {
        ...mockRedisWrongTypeError,
        command: 'ZREM',
      };
      when(browserTool.execCommand)
        .calledWith(
          mockClientOptions,
          BrowserToolZSetCommands.ZRem,
          expect.anything(),
        )
        .mockRejectedValue(replyError);

      await expect(
        service.deleteMembers(mockClientOptions, mockDeleteMembersDto),
      ).rejects.toThrow(BadRequestException);
    });
    it("user don't have required permissions for deleteMembers", async () => {
      const replyError: ReplyError = {
        ...mockRedisNoPermError,
        command: 'ZREM',
      };
      browserTool.execCommand.mockRejectedValue(replyError);

      await expect(
        service.deleteMembers(mockClientOptions, mockDeleteMembersDto),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('searchMembers', () => {
    beforeEach(() => {
      when(browserTool.execCommand)
        .calledWith(mockClientOptions, BrowserToolZSetCommands.ZCard, [
          mockSearchMembersDto.keyName,
        ])
        .mockResolvedValue(mockAddMembersDto.members.length);
    });
    it('succeeded to search members in ZSet data type', async () => {
      when(browserTool.execCommand)
        .calledWith(
          mockClientOptions,
          BrowserToolZSetCommands.ZScan,
          expect.anything(),
        )
        .mockResolvedValue([0, ['member1', '0', 'member2', '2']]);

      const result = await service.searchMembers(
        mockClientOptions,
        mockSearchMembersDto,
      );
      await expect(result).toEqual(mockSearchZSetMembersResponse);
      expect(browserTool.execCommand).toHaveBeenCalledWith(
        mockClientOptions,
        BrowserToolZSetCommands.ZScan,
        expect.anything(),
      );
    });
    it('succeed to find exact member in the z-set', async () => {
      const item = { name: 'member', score: 2 };
      const dto: SearchZSetMembersDto = {
        ...mockSearchMembersDto,
        match: item.name,
      };
      when(browserTool.execCommand)
        .calledWith(mockClientOptions, BrowserToolZSetCommands.ZScore, [
          dto.keyName,
          dto.match,
        ])
        .mockResolvedValue(item.score);

      const result = await service.searchMembers(mockClientOptions, dto);

      expect(result).toEqual({
        ...mockSearchZSetMembersResponse,
        members: [item],
      });
      expect(browserTool.execCommand).not.toHaveBeenCalledWith(
        mockClientOptions,
        BrowserToolZSetCommands.ZScan,
        expect.anything(),
      );
    });
    it('failed to find exact member in the set', async () => {
      const dto: SearchZSetMembersDto = {
        ...mockSearchMembersDto,
        match: 'member',
      };
      when(browserTool.execCommand)
        .calledWith(mockClientOptions, BrowserToolZSetCommands.ZScore, [
          dto.keyName,
          dto.match,
        ])
        .mockResolvedValue(null);

      const result = await service.searchMembers(mockClientOptions, dto);

      expect(result).toEqual({ ...mockSearchZSetMembersResponse, members: [] });
    });
    it('should not call scan when math contains escaped glob', async () => {
      const dto: SearchZSetMembersDto = {
        ...mockSearchMembersDto,
        match: 'm\\[a-e\\]mber',
      };
      when(browserTool.execCommand)
        .calledWith(mockClientOptions, BrowserToolZSetCommands.ZScore, [
          dto.keyName,
          'm[a-e]mber',
        ])
        .mockResolvedValue(1);

      const result = await service.searchMembers(mockClientOptions, dto);

      expect(result).toEqual({
        ...mockSearchZSetMembersResponse,
        members: [{ name: 'm[a-e]mber', score: 1 }],
      });
      expect(browserTool.execCommand).not.toHaveBeenCalledWith(
        mockClientOptions,
        BrowserToolZSetCommands.ZScan,
        expect.anything(),
      );
    });
    // TODO: uncomment after enabling threshold for z-set scan
    // it('should stop z-set full scan', async () => {
    //   const dto: SearchZSetMembersDto = {
    //     ...mockSearchMembersDto,
    //     count: REDIS_SCAN_CONFIG.countDefault,
    //     match: '*un-exist-member*',
    //   };
    //   const maxScanCalls = Math.round(
    //     REDIS_SCAN_CONFIG.countThreshold / REDIS_SCAN_CONFIG.countDefault,
    //   );
    //   when(browserTool.execCommand)
    //     .calledWith(
    //       mockClientOptions,
    //       BrowserToolZSetCommands.ZScan,
    //       expect.anything(),
    //     )
    //     .mockResolvedValue(['200', []]);
    //
    //   await service.searchMembers(mockClientOptions, dto);
    //
    //   expect(browserTool.execCommand).toHaveBeenCalledTimes(maxScanCalls + 1);
    // });
    it('key with this name does not exist for searchMembers', async () => {
      when(browserTool.execCommand)
        .calledWith(mockClientOptions, BrowserToolZSetCommands.ZCard, [
          mockSearchMembersDto.keyName,
        ])
        .mockResolvedValue(0);

      await expect(
        service.searchMembers(mockClientOptions, mockSearchMembersDto),
      ).rejects.toThrow(NotFoundException);
      expect(browserTool.execCommand).toHaveBeenCalledTimes(1);
    });
    it("try to use 'ZCARD' command not for zset data type", async () => {
      const replyError: ReplyError = {
        ...mockRedisWrongTypeError,
        command: 'ZCARD',
      };
      browserTool.execCommand.mockRejectedValue(replyError);

      await expect(
        service.searchMembers(mockClientOptions, mockSearchMembersDto),
      ).rejects.toThrow(BadRequestException);
    });
    it("user don't have required permissions for searchMembers", async () => {
      const replyError: ReplyError = {
        ...mockRedisNoPermError,
        command: 'ZCARD',
      };
      browserTool.execCommand.mockRejectedValue(replyError);

      await expect(
        service.searchMembers(mockClientOptions, mockSearchMembersDto),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
