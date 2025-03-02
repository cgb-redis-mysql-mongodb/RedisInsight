import { cloneDeep } from 'lodash'
import React from 'react'
import {
  cleanup,
  clearStoreActions,
  fireEvent,
  mockedStore,
  render,
  screen,
} from 'uiSrc/utils/test-utils'
import { setSearchMatch } from 'uiSrc/slices/keys'
import { IKeyListPropTypes } from 'uiSrc/constants/prop-types/keys'
import { mockVirtualTreeResult } from 'uiSrc/components/virtual-tree/VirtualTree.spec'
import { setBrowserTreeNodesOpen, setBrowserTreeSelectedLeaf } from 'uiSrc/slices/app/context'
import KeyTree from './KeyTree'

let store: typeof mockedStore
beforeEach(() => {
  cleanup()
  store = cloneDeep(mockedStore)
  store.clearActions()
})

const propsMock = {
  keysState: {
    keys: [
      {
        name: 'key1',
        type: 'hash',
        ttl: -1,
        size: 100,
        length: 100,
      },
      {
        name: 'key2',
        type: 'hash',
        ttl: -1,
        size: 150,
        length: 100,
      },
      {
        name: 'key3',
        type: 'hash',
        ttl: -1,
        size: 110,
        length: 100,
      },
    ],
    nextCursor: '0',
    total: 3,
  } as IKeyListPropTypes,
  loading: false,
  selectKey: jest.fn(),
}

const mockLeafKeys = {
  test: { name: 'test', type: 'hash', ttl: -1, size: 9849176 }
}

const mockWebWorkerResult = [{
  children: [{
    children: [],
    fullName: 'car:110:',
    id: '0.snc1rc3zwgo',
    keyApproximate: 0.01,
    keyCount: 1,
    name: '110',
  }],
  fullName: 'car:',
  id: '0.sz1ie1koqi8',
  keyApproximate: 47.18,
  keyCount: 4718,
  name: 'car',
},
{
  children: [],
  fullName: 'test',
  id: '0.snc1rc3zwg1o',
  keyApproximate: 0.01,
  keyCount: 1,
  name: 'test',
  keys: mockLeafKeys
}]

jest.mock('uiSrc/services', () => ({
  ...jest.requireActual('uiSrc/services'),
  useDisposableWebworker: () => ({ result: mockWebWorkerResult, run: jest.fn() }),
}))

describe('KeyTree', () => {
  it('Key tree separator should be in the document', () => {
    render(<KeyTree {...propsMock} />)

    expect(screen.getByTestId('select-tree-view-separator')).toBeInTheDocument()
  })

  it('Tree view panel should be in the document', () => {
    const { container } = render(<KeyTree {...propsMock} />)

    expect(container.querySelector('[data-test-subj="tree-view-panel"]')).toBeInTheDocument()
  })

  it('Key list panel should be in the document', () => {
    const { container } = render(<KeyTree {...propsMock} />)

    expect(container.querySelector('[data-test-subj="key-list-panel"]')).toBeInTheDocument()
  })

  it.only('"setBrowserTreeNodesOpen" should be called for Open a node', () => {
    render(<KeyTree {...propsMock} />)

    fireEvent.click(screen.getByTestId(mockVirtualTreeResult?.[0]?.fullName))

    const expectedActions = [setBrowserTreeSelectedLeaf({}), setBrowserTreeNodesOpen({})]

    expect(clearStoreActions(store.getActions())).toEqual(
      clearStoreActions(expectedActions)
    )
  })

  it.skip('"setSearchMatch" should be called after "onChange"', () => {
    const searchTerm = 'a'

    render(<KeyTree {...propsMock} />)

    fireEvent.change(screen.getByTestId('search-key'), {
      target: { value: searchTerm },
    })

    const expectedActions = [setSearchMatch(searchTerm)]

    expect(clearStoreActions(store.getActions())).toEqual(
      clearStoreActions(expectedActions)
    )
  })
})
