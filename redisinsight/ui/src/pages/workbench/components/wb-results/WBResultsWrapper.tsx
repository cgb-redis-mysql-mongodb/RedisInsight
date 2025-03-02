import React from 'react'
import { CommandExecutionUI } from 'uiSrc/slices/interfaces'
import WBResults from './WBResults'
import { WBQueryType } from '../../constants'

export interface Props {
  items: CommandExecutionUI[];
  scrollDivRef: React.Ref<HTMLDivElement>;
  onQueryReRun: (query: string, commandId?: string, type?: WBQueryType) => void;
  onQueryOpen: (commandId: string) => void
  onQueryDelete: (commandId: string) => void
}

const WBResultsWrapper = (props: Props) => (
  <WBResults {...props} />
)

export default WBResultsWrapper
