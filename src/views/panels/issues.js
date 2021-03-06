import { createWebUI, IssuePanelId } from './webui-common'
import Filters from './helpers/filters'
import Uploads from './helpers/uploads'
import Attachments from './helpers/attachments'
import analytics from '../../analytics'
import { akGridSizeUnitless } from '@atlaskit/util-shared-styles'
import { titlebarHeight } from './ui-constants'
import JIRA from '../../jira'
import openConnectPanel from './connect'
import exportButton from '../controls/export-button'
import keepOrReplaceAlert from '../alerts/keep-or-replace'
import { setSelectedIssueKey, setExportSelectedLayersFn } from '../../plugin-state'

const issueListDimensions = [
  akGridSizeUnitless * 64,
  akGridSizeUnitless * 45 + titlebarHeight
]

const issueViewDimensions = [
  akGridSizeUnitless * 64,
  akGridSizeUnitless * 50
]

/**
 * Spawns the 'JIRA' panel for browsing and interacting with JIRA issues.
 *
 * @param {Object} context provided by Sketch
 * @return {Object} a WebUI for the launched panel
 */
export default function (context) {
  const webUI = createWebUI(context, IssuePanelId, 'issues.html', {
    width: issueListDimensions[0],
    height: issueListDimensions[1],
    onClose: function () {
      exportButton.remove(context)
      setExportSelectedLayersFn(null)
      setSelectedIssueKey(null)
    },
    handlers: {
      async loadFilters () {
        return filters.loadFilters()
      },
      loadProfile () {
        return jira.getProfile()
      },
      loadIssuesForFilter (filterKey) {
        return filters.onFilterChanged(filterKey)
      },
      getDroppedFiles () {
        return uploads.getDroppedFiles()
      },
      uploadAttachment (issueKey, attachment, progress) {
        return uploads.uploadAttachment(issueKey, attachment, progress)
      },
      promptKeepOrReplace (issueKey, matchingImages) {
        return keepOrReplaceAlert(context, issueKey, matchingImages)
      },
      getIssue (issueKey, updateHistory) {
        return attachments.getIssue(issueKey, updateHistory)
      },
      onIssueSelected (issueKey) {
        webUI.resizePanel(...issueViewDimensions)
        exportButton.add(context)
        setSelectedIssueKey(issueKey)
      },
      onIssueDeselected (issueKey) {
        webUI.resizePanel(...issueListDimensions)
        exportButton.remove(context)
        setSelectedIssueKey(null)
      },
      getWatchers (issueKey) {
        return jira.getWatchers(issueKey)
      },
      getThumbnail (url, mimeType) {
        return attachments.getThumbnail(url, mimeType)
      },
      openAttachment (url, filename, progress) {
        return attachments.openAttachment(url, filename, progress)
      },
      deleteAttachment (id) {
        return attachments.deleteAttachment(id)
      },
      addComment (issueKey, comment) {
        analytics.viewIssueCommentAdd({
          length: comment.length,
          lines: comment.split('\n').length
        })
        return jira.addComment(issueKey, comment)
      },
      findUsersForPicker (query) {
        return jira.findUsersForPicker(query)
      },
      viewSettings () {
        webUI.panel.close()
        openConnectPanel(context)
      },
      reauthorize () {
        webUI.panel.close()
        openConnectPanel(context)
      }
    }
  })

  var jira = new JIRA()
  var filters = new Filters(context, webUI, jira)
  var attachments = new Attachments(context, webUI, jira)
  var uploads = new Uploads(context, webUI, jira, attachments)

  setExportSelectedLayersFn(function () {
    uploads.exportSelectedLayersToSelectedIssue()
  })

  analytics.viewIssueListPanelOpen()

  return webUI
}
