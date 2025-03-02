/* eslint-disable no-console */
import React, { useCallback, useContext, useEffect, useState } from 'react'
import AutoSizer from 'react-virtualized-auto-sizer'
import { isArray, isEmpty } from 'lodash'
import {
  TreeWalker,
  TreeWalkerValue,
  FixedSizeTree as Tree,
} from 'react-vtree'
import { EuiIcon, EuiLoadingSpinner } from '@elastic/eui'

import { useDisposableWebworker } from 'uiSrc/services'
import { IKeyPropTypes } from 'uiSrc/constants/prop-types/keys'
import { ThemeContext } from 'uiSrc/contexts/themeContext'
import { DEFAULT_SEPARATOR, Theme } from 'uiSrc/constants'
import KeyLightSVG from 'uiSrc/assets/img/sidebar/browser.svg'
import KeyDarkSVG from 'uiSrc/assets/img/sidebar/browser_active.svg'

import { Node } from './components/Node'
import { NodeMeta, TreeData, TreeNode } from './interfaces'

import styles from './styles.module.scss'

export interface Props {
  items: IKeyPropTypes[]
  separator?: string
  loadingIcon?: string
  loading: boolean
  statusSelected: {
    [key: string]: IKeyPropTypes[]
  }
  statusOpen: {
    [key: string]: boolean
  }
  webworkerFn: (...args: any) => any
  onSelectLeaf?: (items: any[]) => void
  onStatusOpen?: (name: string, value: boolean) => void
  onStatusSelected?: (id: string, keys: any) => void
  setConstructingTree: (status: boolean) => void
}

const timeLabel = 'Time for construct a Tree'
const VirtualTree = (props: Props) => {
  const {
    items,
    separator = DEFAULT_SEPARATOR,
    loadingIcon = 'empty',
    statusOpen = {},
    statusSelected = {},
    loading,
    onStatusOpen,
    onStatusSelected,
    onSelectLeaf,
    setConstructingTree,
    webworkerFn = () => {}
  } = props

  const { theme } = useContext(ThemeContext)

  const [nodes, setNodes] = useState<TreeNode[]>([])
  const [firstConstruct, setFirstConstruct] = useState(false)

  const { result, run: runWebworker } = useDisposableWebworker(webworkerFn)

  useEffect(() =>
    () => setNodes([]),
  [])

  // receive result from the "runWebworker"
  useEffect(() => {
    if (!result) {
      return
    }
    // [ToDo] remove after tests
    console.timeEnd(timeLabel)

    setNodes(result)
    setConstructingTree?.(false)

    // set "root" keys after first render (construct a tree)
    if (!firstConstruct && isArray(result) && isEmpty(statusSelected)) {
      const rootLeaf = result?.find(({ children = [] }) => children.length === 0) ?? {}
      setFirstConstruct(true)
      onStatusSelected?.(rootLeaf?.fullName, rootLeaf?.keys)
      onSelectLeaf?.(rootLeaf?.keys ?? [])
    }
  }, [result])

  useEffect(() => {
    if (!items?.length) {
      setNodes([])
      return
    }

    // [ToDo] remove after tests
    console.time(timeLabel)
    setConstructingTree(true)
    runWebworker?.({ items, separator })
  }, [items])

  const handleSelectLeaf = useCallback((keys: any[]) => {
    onSelectLeaf?.(keys)
  }, [onSelectLeaf])

  const handleUpdateSelected = useCallback((fullName: string, keys: any) => {
    onStatusSelected?.(fullName, keys)
  }, [onStatusSelected])

  const handleUpdateOpen = useCallback((name: string, value: boolean) => {
    onStatusOpen?.(name, value)
  }, [onStatusOpen])

  // This helper function constructs the object that will be sent back at the step
  // [2] during the treeWalker function work. Except for the mandatory `data`
  // field you can put any additional data here.
  const getNodeData = (
    node: TreeNode,
    nestingLevel: number,
  ): TreeWalkerValue<TreeData, NodeMeta> => ({
    data: {
      id: node.id.toString(),
      isLeaf: node.children?.length === 0,
      keyCount: node.keyCount,
      name: node.name,
      fullName: node.fullName,
      nestingLevel,
      setItems: handleSelectLeaf,
      updateStatusSelected: handleUpdateSelected,
      updateStatusOpen: handleUpdateOpen,
      leafIcon: theme === Theme.Dark ? KeyDarkSVG : KeyLightSVG,
      keyApproximate: node.keyApproximate,
      keys: node.keys || node?.['keys:keys'],
      isSelected: Object.keys(statusSelected)[0] === node.fullName,
      isOpenByDefault: statusOpen[node.fullName],
    },
    nestingLevel,
    node,
  })

  // The `treeWalker` function runs only on tree re-build which is performed
  // whenever the `treeWalker` prop is changed.
  const treeWalker = useCallback(
    function* treeWalker(): ReturnType<TreeWalker<TreeData, NodeMeta>> {
      // Step [1]: Define the root multiple nodes of our tree
      for (let i = 0; i < nodes.length; i++) {
        yield getNodeData(nodes[i], 0)
      }

      // Step [2]: Get the parent component back. It will be the object
      // the `getNodeData` function constructed, so you can read any data from it.
      while (true) {
        const parentMeta = yield

        for (let i = 0; i < parentMeta.node.children?.length; i++) {
          // Step [3]: Yielding all the children of the provided component. Then we
          // will return for the step [2] with the first children.
          yield getNodeData(
            parentMeta.node.children[i],
            parentMeta.nestingLevel + 1,
          )
        }
      }
    },
    [nodes, statusSelected],
  )

  return (
    <AutoSizer>
      {({ height, width }) => (
        <div data-testid="auto-sizer">
          { nodes.length > 0 && (
            <Tree
              height={height}
              width={width}
              itemSize={30}
              treeWalker={treeWalker}
              className={styles.customScroll}
            >
              {Node}
            </Tree>
          )}
          { nodes.length === 0 && loading && (
            <div className={styles.loadingContainer} style={{ width, height }} data-testid="virtual-tree-spinner">
              <div className={styles.loadingBody}>
                <EuiLoadingSpinner size="xl" className={styles.loadingSpinner} />
                <EuiIcon type={loadingIcon || 'empty'} className={styles.loadingIcon} />
              </div>
            </div>
          )}
        </div>
      )}
    </AutoSizer>
  )
}

export default VirtualTree
