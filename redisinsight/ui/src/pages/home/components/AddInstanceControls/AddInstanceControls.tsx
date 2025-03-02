import React, { useContext, useEffect, useState } from 'react'
import {
  EuiButton,
  EuiFlexGroup,
  EuiFlexItem,
  EuiSpacer,
  EuiText,
} from '@elastic/eui'
import { isEmpty } from 'lodash'
import { useSelector } from 'react-redux'
import { sendEventTelemetry, TelemetryEvent } from 'uiSrc/telemetry'
import HelpLinksMenu from 'uiSrc/pages/home/components/HelpLinksMenu'
import PromoLink from 'uiSrc/components/promo-link/PromoLink'
import { ThemeContext } from 'uiSrc/contexts/themeContext'
import { contentSelector } from 'uiSrc/slices/content/create-redis-buttons'
import { HELP_LINKS, IHelpGuide } from 'uiSrc/pages/home/constants/help-links'
import { getPathToResource } from 'uiSrc/services/resourcesService'
import { ContentCreateRedis } from 'uiSrc/slices/interfaces/content'

import styles from './styles.module.scss'

export interface Props {
  onAddInstance: () => void
  direction: 'column' | 'row'
  welcomePage?: boolean
}

const AddInstanceControls = ({ onAddInstance, direction, welcomePage = false }: Props) => {
  const [promoData, setPromoData] = useState<ContentCreateRedis>()
  const [guides, setGuides] = useState<IHelpGuide[]>([])
  const { loading, data } = useSelector(contentSelector)
  const { theme } = useContext(ThemeContext)

  useEffect(() => {
    if (loading || !data || isEmpty(data)) {
      return
    }
    if (data?.cloud && !isEmpty(data.cloud)) {
      setPromoData(data.cloud)
    }
    const items = Object.entries(data).map(([key, { title, links, description }]) => ({
      id: key,
      title,
      description,
      event: HELP_LINKS[key as keyof typeof HELP_LINKS]?.event,
      url: links?.main?.url,
      primary: key.toLowerCase() === 'cloud',
    }))
    setGuides(items)
  }, [loading, data])

  const handleOnAddDatabase = () => {
    sendEventTelemetry({
      event: TelemetryEvent.CONFIG_DATABASES_CLICKED,
    })
    onAddInstance()
  }

  const handleClickLink = (event: TelemetryEvent, eventData: any = {}) => {
    if (event) {
      sendEventTelemetry({
        event,
        eventData: {
          ...eventData
        }
      })
    }
  }

  const AddInstanceBtn = () => (
    <EuiButton
      fill
      color="secondary"
      onClick={handleOnAddDatabase}
      className={styles.addInstanceBtn}
      data-testid="add-redis-database"
    >
      + ADD REDIS DATABASE
    </EuiButton>
  )

  const Guides = () => (
    <div className={styles.links}>
      <EuiFlexGroup>
        <EuiFlexItem grow={false} className={styles.clearMarginFlexItem}>
          <EuiText className={styles.followText}>
            {promoData ? 'Or follow the guides:' : 'Follow the guides:'}
          </EuiText>
        </EuiFlexItem>
      </EuiFlexGroup>
      <EuiFlexGroup className={styles.otherGuides}>
        {guides
          .filter(({ id }) => id?.toLowerCase() !== 'cloud')
          .map(({ id, url, title, event }) => (
            <EuiFlexItem key={id} grow={direction === 'column'}>
              <a
                href={url}
                onClick={() => handleClickLink(event as TelemetryEvent)}
                target="_blank"
                rel="noreferrer"
              >
                {title}
              </a>
            </EuiFlexItem>
          ))}
      </EuiFlexGroup>
    </div>
  )

  const CreateBtn = ({ content }: { content: ContentCreateRedis }) => {
    const { title, description, styles, links } = content
    // @ts-ignore
    const linkStyles = styles ? styles[theme] : {}
    return (
      <PromoLink
        title={title}
        description={description}
        url={links?.main?.url}
        testId="promo-btn"
        icon="arrowRight"
        styles={{
          ...linkStyles,
          backgroundImage: linkStyles?.backgroundImage
            ? `url(${getPathToResource(linkStyles.backgroundImage)})`
            : undefined
        }}
        onClick={() => handleClickLink(
          HELP_LINKS.cloud.event,
          { source: welcomePage ? 'Welcome page' : 'My Redis databases' }
        )}
      />
    )
  }

  return direction === 'column'
    ? (
      <div className={styles.containerWelc}>
        <EuiFlexGroup alignItems="center" responsive={false}>
          <EuiFlexItem>
            <AddInstanceBtn />
          </EuiFlexItem>
        </EuiFlexGroup>
        <EuiFlexGroup>
          <EuiFlexItem>
            <div className={styles.separator} />
          </EuiFlexItem>
        </EuiFlexGroup>
        { !loading && !isEmpty(data) && (
          <>
            {promoData && (
              <EuiFlexGroup>
                <EuiFlexItem>
                  <CreateBtn content={promoData} />
                </EuiFlexItem>
              </EuiFlexGroup>
            )}
            <Guides />
          </>
        )}
        <EuiSpacer />
      </div>
    ) : (
      <div className={styles.containerDl}>
        <EuiFlexGroup className={styles.contentDL} alignItems="center" responsive={false}>
          <EuiFlexItem grow={false}>
            <AddInstanceBtn />
          </EuiFlexItem>
          <EuiFlexItem className="eui-hideFor--xs" grow={false}>
            <div className={styles.separator} />
          </EuiFlexItem>
          { !loading && !isEmpty(data) && (
            <>
              <EuiFlexItem grow className="eui-showFor--xl">
                <EuiFlexGroup alignItems="center">
                  {promoData && (
                    <EuiFlexItem grow={false}>
                      <CreateBtn content={promoData} />
                    </EuiFlexItem>
                  )}
                  <EuiFlexItem>
                    <Guides />
                  </EuiFlexItem>
                </EuiFlexGroup>
              </EuiFlexItem>
              <EuiFlexItem grow={false} className="eui-showFor--xs eui-showFor--s eui-showFor--m eui-showFor--l">
                <HelpLinksMenu
                  items={guides}
                  onLinkClick={(link) => handleClickLink(HELP_LINKS[link as keyof typeof HELP_LINKS]?.event)}
                />
              </EuiFlexItem>
            </>
          )}
        </EuiFlexGroup>
        <EuiSpacer className={styles.spacerDl} />
      </div>
    )
}

export default AddInstanceControls
