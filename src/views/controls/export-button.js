import { error, trace } from '../../logger'
import { documentFromContext } from '../../util'
import buttonDelegate, { onClickSelector } from './button-delegate'
import { triggerExportSelectedLayers } from '../../plugin-state'

export default { add, remove }

const jiraButtonToolTip = 'Export to JIRA'
const exportButtonOffset = 44

/**
 * *Carefully* try to add an 'Export to JIRA' button to Sketch's export panel.
 * Care is taken to ensure that if the Sketch UI is not structured as we expect,
 * the button simply fails to appear and prints a suitable log message, rather
 * than crashing Sketch. See inline below for the documented assumptions about
 * the structure of the Sketch UI.
 *
 * @param {Object} context provided by Sketch
 */
async function add (context) {
  withExportButtonBar(context, (exportButtonBar) => {
    const exportButtons = exportButtonBar.subviews()

    // Assumption: There are two standard export buttons (plus ours)
    if (exportButtons.length == 3) {
      const jiraButton = exportButtons[2]
      const toolTip = jiraButton.toolTip && jiraButton.toolTip()
      if (toolTip && toolTip == jiraButtonToolTip) {
        // button already registered \o/
      } else {
        error(`Found three export buttons, but the 'Export to JIRA' button isn't there`)
      }
      return
    }

    // Assumption: There are two standard export buttons
    // Assumption: If they aren't present, the layer is probably collapsed.
    if (exportButtons.length != 2) {
      trace(`Last subview MSExportStackView has ${exportButtons.length} subviews`)
      return
    }

    // Assumption: The first export button title is 'Export $layerName'
    // Assumption: Sketch is not internationalized (verify!)
    const exportButton = exportButtons[0]
    const title = exportButton.title && exportButton.title()
    if (!title || title.indexOf('Export ') != 0) {
      trace(`Possible export button has title: ${title}`)
      return
    }

    // Add the JIRA button
    const uploadIcon = NSImage.alloc().initWithContentsOfFile(
      context.plugin.urlForResourceNamed('upload-icon.png').path()
    )
    const jiraButtonDelegate = buttonDelegate({
      onClick: function () {
        if (!triggerExportSelectedLayers()) {
          error('Failed to trigger export of selected layers')
        }
      }
    })
    const jiraButton = NSButton.buttonWithImage_target_action(
      uploadIcon,
      jiraButtonDelegate,
      onClickSelector
    )
    jiraButton.setToolTip(jiraButtonToolTip)

    exportButtonBar.addSubview(jiraButton)
    jiraButton.setFrame(NSMakeRect(110, -2, 56, 32))

    // Adjust the sizing of the 'Export $layerName' button to make room for the JIRA button
    // Assumption: The first subview is the 'Export $layerName' button
    const eFrame = exportButton.frame()
    exportButton.setFrame(NSMakeRect(
        eFrame.origin.x,
        eFrame.origin.y,
        eFrame.size.width - exportButtonOffset,
        eFrame.size.height
    ))
  })
}

/**
 * *Carefully* try to remove the 'Export to JIRA' button from Sketch's export
 * panel, and restore the UI to its previous state. If the Sketch UI is not
 * structured as we expect, bail out and print a suitable log message, rather
 * than attempting to remove the button (or crashing Sketch).
 *
 * @param {Object} context provided by Sketch
 */
async function remove (context) {
  withExportButtonBar(context, (exportButtonBar) => {
    const exportButtons = exportButtonBar.subviews()

    // Assumption: There are two standard export buttons (plus our JIRA button)
    // Assumption: If they aren't present, the layer is probably collapsed or the button isn't present
    if (exportButtons.length != 3) {
      trace(`Last subview MSExportStackView has ${exportButtons.length} subviews`)
      return
    }

    const jiraButton = exportButtons[2]
    const toolTip = jiraButton.toolTip && jiraButton.toolTip()
    if (toolTip != jiraButtonToolTip) {
      error(`'${jiraButtonToolTip}' button wasn't where it should be`)
      return
    }

    // Re-adjust the sizing of the 'Export $layerName' button once we remove the JIRA button
    // Assumption: The first subview is the 'Export $layerName' button
    const exportButton = exportButtons[0]
    jiraButton.removeFromSuperview()
    const eFrame = exportButton.frame()
    exportButton.setFrame(NSMakeRect(
        eFrame.origin.x,
        eFrame.origin.y,
        eFrame.size.width + exportButtonOffset,
        eFrame.size.height
    ))
  })
}

/**
 * Attempt to locate the NSView containing Sketch's export buttons.
 *
 * @param {Object} context provided by Sketch
 * @param {*} callback invoked with the NSView containing Sketch's export buttons.
 */
function withExportButtonBar (context, callback) {
  const document = documentFromContext(context)
  if (!document) {
    return
  }
  const contentView = document.documentWindow().contentView()
  if (!contentView) {
    return
  }

  // Assumption: the NSView subclass for exports is named 'MSExportStackView'
  const exportStackView = findSubviewWithClass(contentView, 'MSExportStackView')
  if (!exportStackView) {
    trace('Couldn\'t find MSExportStackView')
    return
  }

  // Assumption: No subviews for 'MSExportStackView' the selection can't be exported (?)
  const exportSubviews = exportStackView.subviews()
  if (exportSubviews.length == 0) {
    trace('MSExportStackView has no subviews')
    return
  }

  // Assumption: Export button bar is always the last subview of 'MSExportStackView'
  return callback(exportSubviews[exportSubviews.length - 1])
}

/**
 * Recursively walk the subviews of an NSView to find an instance of a
 * particular class. Subviews are walked in reverse order, since this is more
 * efficient in the current version of Sketch at time of writing.
 *
 * @param {Object} view the parent NSView to search
 * @param {string} clazz the name of the class to be found
 */
function findSubviewWithClass (view, clazz) {
  if (view.class() == clazz) {
    return view
  }
  if (view.subviews) {
    const subviews = view.subviews()
    // Assumption: the Export panel is in the bottom right, so let's walk the tree
    // backwards to find it
    for (var i = subviews.length - 1; i >= 0; i--) {
      const result = findSubviewWithClass(subviews[i], clazz)
      if (result) {
        return result
      }
    }
  }
  return null
}
