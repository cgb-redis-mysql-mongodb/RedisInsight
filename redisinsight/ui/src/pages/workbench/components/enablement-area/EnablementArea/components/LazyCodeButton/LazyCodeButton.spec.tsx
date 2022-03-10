import React from 'react'
import { instance, mock } from 'ts-mockito'
import { MONACO_MANUAL } from 'uiSrc/constants'
import { fireEvent, render, waitFor } from 'uiSrc/utils/test-utils'
import { resourcesService } from 'uiSrc/services'
import { GuidesProvider, defaultValue } from 'uiSrc/pages/workbench/contexts/guidesContext'

import LazyCodeButton, { Props } from './LazyCodeButton'

const mockedProps = mock<Props>()

describe('LazyCodeButton', () => {
  it('should render', () => {
    const label = 'Manual'
    const component = render(<LazyCodeButton {...instance(mockedProps)} label={label} />)
    const { container } = component

    expect(component).toBeTruthy()
    expect(container).toHaveTextContent(label)
  })
  it('should call setScript', async () => {
    const httpResponse = { status: 200, data: MONACO_MANUAL }
    const setScript = jest.fn()
    resourcesService.get = jest.fn().mockResolvedValue(httpResponse)

    const { queryByTestId } = render(
      <GuidesProvider value={{ ...defaultValue, setScript }}>
        <LazyCodeButton label="script" path="/static/script.txt" />
      </GuidesProvider>
    )

    await waitFor(() => {
      const button = queryByTestId('preselect-script')
      fireEvent.click(button as Element)
    })

    expect(setScript).toBeCalled()
  })
  it('should not call setScript on fetch error', async () => {
    const setScript = jest.fn()
    const httpResponse = {
      response: {
        status: 500,
        data: { message: 'Error' },
      },
    }
    resourcesService.get = jest.fn().mockRejectedValue(httpResponse)

    const { queryByTestId } = render(
      <GuidesProvider value={{ ...defaultValue, setScript }}>
        <LazyCodeButton label="script" path="/static/script.txt" />
      </GuidesProvider>
    )

    await waitFor(() => {
      const button = queryByTestId('preselect-script')
      fireEvent.click(button as Element)
    })

    expect(setScript).not.toBeCalled()
  })
})
