import React from 'react'
import ReactDOM from 'react-dom'
import $ from 'jquery'

const HOST_LOCAL = 'http://' + (window.location.host ? window.location.host : 'localhost') + ':8080'
const HOST_APPENGINE = 'https://amaloyresume.appspot.com'
const QUERY_ALT_HOST = '?altHost'
const SERVICE_URL = determineServiceUrl()
const RESUME_PATH = '/resume/'
const LINKS = '_links'
const SELF_LINK = 'self'
const EVERYTHING = 'everything'
const SECTIONS = 'sections'
const TAGS = 'tags'
const TOGGLE_BACKEND = '!backend'
const MAIN_CONTENT_PICK = '<br><br>&lt-- Pick something'
const MAIN_CONTENT_ERROR = '<br><br>Couldn\'t connect.<br><br>Try "' + TOGGLE_BACKEND + '" over on the left.'

let headerContent = ''
let workingContent = ''

function isAltHost() {
  return window.location.href.endsWith(QUERY_ALT_HOST)
}

function determineServiceUrl(altHost) {
  if (window.location.host) {
    if (isAltHost()) {
      return HOST_LOCAL
    } else {
      return HOST_APPENGINE
    }
  } else {
    return HOST_APPENGINE
  }
}

function callApi (href, success, fail) {
  $.ajax({
    url: SERVICE_URL + href,
    dataType: 'json',
    cache: false,
    async: false,
    success: success,
    error: fail
  })
}

const MenuItem = React.createClass({
  handleClick: function () {
    this.props.callback(this.props.type, this.props.href)
  },
  render: function () {
    return (<div><a onClick={this.handleClick} href="#">{this.props.label}</a></div>)
  }
})

const MenuList = React.createClass({
  getInitialState: function () {
    return {items: []}
  },
  setItems: function (newItems) {
    this.setState({items: newItems})
  },
  componentDidMount: function () {
    callApi(this.props.href, this.setItems)
  },
  render: function () {
    const callback = this.props.callback
    const type = this.props.type
    const renderedItems = this.state.items.map(function (item) {
      return (<MenuItem
        label={item.id}
        type={type}
        href={item._links.self.href}
        callback={callback} />)
    })
    return (<div>
      <div className="menuListHeader">{this.props.type}</div>
      <div>{renderedItems}</div>
    </div>)
  }
})

const MainContent = React.createClass({
  getInitialState: function () {
    return {content: MAIN_CONTENT_PICK}
  },
  setContent: function (newContent) {
    this.setState({content: newContent})
  },
  render: function () {
    return (<div dangerouslySetInnerHTML={{__html: this.state.content}} />)
  }
})

const mainContent = ReactDOM.render(
  <MainContent />,
  document.getElementById('mainContent')
)

function clearContent () {
  workingContent = ''
}

function addContent (content) {
  workingContent += content
}

function parseSectionContent (href) {
  callApi(href, function (json) {
    addContent(json.content)
    for (var subsection of json.subsections) {
      addContent(subsection.content)
    }
    mainContent.setContent(workingContent)
  })
}

function parseContent (type, href) {
  clearContent()
  addContent(headerContent)
  if (type === SECTIONS) {
    parseSectionContent(href)
  } else if (type === TAGS) {
    callApi(href, function (json) {
      for (var section of json.sections) {
        parseSectionContent(section[LINKS][SELF_LINK].href)
      }
    })
  } else if (type === EVERYTHING) {
    callApi(href, function (json) {
      for (var section of json) {
        parseSectionContent(section[LINKS][SELF_LINK].href)
      }
    })
  }
}

function switchBackendHref() {
  if (isAltHost()) {
    return window.location.href.slice(0, -QUERY_ALT_HOST.length)
  } else {
    return window.location.href + QUERY_ALT_HOST
  }
}

const menuAlways = (
  <div><a title={'Current backend: '+SERVICE_URL} href={switchBackendHref()}>{TOGGLE_BACKEND}</a></div>
);

// Initial API call to kick off building of menus
callApi(RESUME_PATH, function (json) {
  headerContent = json['content']

  let orderedLinks = []
  function pushOrderedLink(link) {
    if (json[LINKS][link]) {
      orderedLinks.push(link)
    }
  }
  // We always want sections and tags to be first and in this order
  pushOrderedLink(SECTIONS)
  pushOrderedLink(TAGS)
  // Add any remaining links as they appear
  Object.keys(json[LINKS]).forEach(function (link) {
    if (link && orderedLinks.indexOf(link) == -1) {
      orderedLinks.push(link)
    }
  })

  const menuLists = orderedLinks.map(function (link) {
    if (link === EVERYTHING) {
      // TODO swagger only on HOST_LOCAL for now. Oops.
      return (<div>
        <div className="menuListHeader">or...</div>
        <div><MenuItem
          label={link + '!'}
          type={link}
          href={json[LINKS][link].href}
          callback={parseContent} /></div>
          <div><a href={HOST_LOCAL + RESUME_PATH + 'swagger'}>swagger doc</a></div>
          {menuAlways}
      </div>)
    } else if (link !== SELF_LINK) {
      return (<MenuList
        type={link}
        href={json[LINKS][link].href}
        callback={parseContent}
      />)
    }
  })
  ReactDOM.render(
    <div>{menuLists}</div>,
    document.getElementById('menuContent')
  )
}, function (err) {
  ReactDOM.render(
    <div>{menuAlways}</div>,
    document.getElementById('menuContent')
  )
  console.log(err)
  mainContent.setContent(MAIN_CONTENT_ERROR)
})
