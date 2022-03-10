import { createSlice } from '@reduxjs/toolkit'
import { ApiEndpoints } from 'uiSrc/constants'
import { getApiErrorMessage, isStatusSuccessful, } from 'uiSrc/utils'
import { resourcesService } from 'uiSrc/services'
import { IEnablementAreaItem, StateWorkbenchEnablementArea } from 'uiSrc/slices/interfaces'

import { AppDispatch, RootState } from '../store'

export const defaultItems: Record<string, IEnablementAreaItem> = {

}
export const initialState: StateWorkbenchEnablementArea = {
  loading: false,
  error: '',
  items: {},
}

// A slice for recipes
const workbencTutorialsSlice = createSlice({
  name: 'workbenchTutorials',
  initialState,
  reducers: {
    getWBTutorials: (state) => {
      state.loading = true
    },
    getWBTutorialsSuccess: (state, { payload }) => {
      state.loading = false
      state.items = payload
    },
    getWBtutorialsFailure: (state, { payload }) => {
      state.loading = false
      state.error = payload
      state.items = defaultItems
    },
  }
})

// A selector
export const workbenchTutorialsSelector = (state: RootState) => state.workbench.tutorials

// Actions generated from the slice
export const {
    getWBTutorials,
    getWBTutorialsSuccess,
    getWBtutorialsFailure,
} = workbencTutorialsSlice.actions

// The reducer
export default workbencTutorialsSlice.reducer

// Asynchronous thunk action
export function fetchTutorials(onSuccessAction?: () => void, onFailAction?: () => void) {
  return async (dispatch: AppDispatch) => {
    dispatch(getWBTutorials())

    try {
      const { data, status } = await resourcesService
        .get<Record<string, IEnablementAreaItem>>(ApiEndpoints.TUTORIALS)
      if (isStatusSuccessful(status)) {
        dispatch(getWBTutorialsSuccess(data))
        onSuccessAction?.()
      }
    } catch (error) {
      const errorMessage = getApiErrorMessage(error)
      dispatch(getWBtutorialsFailure(errorMessage))
      onFailAction?.()
    }
  }
}
