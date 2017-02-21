import React, {PropTypes} from 'react';
import bowser from 'bowser';
import Element from './Element';
import TextEditor from './TextEditor';
// whiteSpace: 'pre',
const wrapProperties = ['text', 'fontSize', 'fontFamily', 'verticalAlign', 'lineHeight', 'textAlign', 'width', 'padding'];
const isFirefox = bowser.firefox;
const isChrome = bowser.chrome;
const isSafari = bowser.safari || (bowser.ios && bowser.safari);
const isMSIEdge = bowser.msie || bowser.msedge;
const textStyle = { whiteSpace: isMSIEdge ? 'pre-wrap' : '', textRendering: 'geometricPrecision'};
const isDebug = process.env.NODE_ENV !== 'production' && process.env.DEBUG;

export default class Text extends Element {

  type = 'text';

  static defaultProps = Object.assign({}, Element.defaultProps, {
    text: '',
    fontSize: 12,
    fontFamily: 'Verdana',
    verticalAlign: 'top',
    lineHeight: 1.5,
    textAlign: 'left',
    fill: 'black',
    padding: 2,
    editable: true
  });

  static propTypes = {
    text: PropTypes.string,
    verticalAlign: PropTypes.oneOf(['top', 'middle', 'bottom']),
    textAlign: PropTypes.oneOf(['left', 'center', 'right']),
    lineHeight: PropTypes.number
  };

  constructor(props, context) {
    super(props, context);
    this.state = {
      measurement: measureText(props),
      editing: false
    };
  }

  createKnobs() {
    if (this.state.editing) {
      return [];
    } else {
      return super.createKnobs();
    }
  }

  processChange(key, value, trigger = true) {
    if (key !== 'width' && wrapProperties.indexOf(key) > -1 && !this.props.height) {
      var change = {};
      change[key] = value;
      const newHeight = measureTextHeight(Object.assign({}, this.props, change)) + (2 * this.props.padding);
      const np = this.calcNewPositionForSize(this.props.width, newHeight, 1, -1);
      this.processChange('x', np.x, false);
      this.processChange('y', np.y, false);
    }
    super.processChange(key, value, trigger);
  }

  calcBBox() {
    const node = this.textRectNode;
    if (!node) return null;
    return node.getBBox();
  }

  processKnobChange(knob, dir, diffVector) {
    if (dir === 'l' || dir === 'r') {
      var np, newHeight, newWidth;
      switch (dir) {
        case 'l':
          newWidth = this.props.width - diffVector.x;
          newHeight = measureTextHeight(Object.assign({}, this.props, {width: newWidth})) + (2 * this.props.padding);
          np = this.calcNewPositionForSize(newWidth, newHeight, 1, -1);
          this.processChange('x', np.x, false);
          this.processChange('y', np.y, false);
          this.processChange('width', newWidth, true);
          break;
        case 'r':
          newWidth = this.props.width + diffVector.x;
          newHeight = measureTextHeight(Object.assign({}, this.props, {width: newWidth})) + (2 * this.props.padding);
          np = this.calcNewPositionForSize(newWidth, newHeight, -1, -1);
          this.processChange('x', np.x, false);
          this.processChange('y', np.y, false);
          this.processChange('width', newWidth, true);

          break;
        default:
          break;
      }
    } else {
      super.processChange(knob, dir, diffVector);
    }
  }

  componentWillReceiveProps(nextProps) {
    for (let i = 0; i < wrapProperties.length; i += 1) {
      let key = wrapProperties[i];
      if (nextProps[key] !== this.props[key]) {
        this.setState({
          measurement: measureText(nextProps)
        });
        break;
      }
    }
  }

  componentDidMount() {
    this.wrapText();
    super.componentDidMount();
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.state.measurement !== prevState.measurement) {
      this.wrapText();
    }

    super.componentDidUpdate(prevProps, prevState);

    if (this.state.editing !== prevState.editing) {
      this.context.api.selectionChanged();
      if (!this.state.editing) {
        this.textEditor && this.textEditor.deactivate();
      } else {
        this.textEditor && this.textEditor.activate();
      }
    }

    if (this.state.bboxX !== prevState.bboxX || this.state.bboxY !== prevState.bboxY) {
      setTimeout(() => {
        this.textEditor && this.textEditor.repositionTextArea();
      }, 1);
    }
  }

  wrapText() {
    const rects = this.state.measurement.rects;
    const baseline = this.state.measurement.baseline;
    let textContent = this.props.text;
    const svgRoot = this.svgRoot();
    const p = svgRoot.createSVGPoint();

    if (rects) {
      let rect;
      let textNode;
      const mearureTreshhold = this.props.fontSize * 0.1;
      let num;
      let lastTop = rects[0].top;
      let hardLines = textContent.split('\n');
      let hardLineIndex = 0;
      let lastLineIndex = hardLineIndex;
      let currentLine = hardLines[hardLineIndex];
      let currentLineIndex = hardLineIndex;
      let lastTextContent = '';
      for (let i = 0; i < rects.length; i++) {
        rect = rects[i];
        textNode = this.textWrapperNode.childNodes[i];
        textNode.removeAttributeNS(null, 'x');
        textNode.removeAttributeNS(null, 'y');
        if(lastTop !== rect.top) {
          currentLineIndex++;
        }
        // if we have a softbreak delete all leading spaces
        if (lastLineIndex === hardLineIndex && lastTop !== rect.top && !isMSIEdge) {
          if (/\s/.test(lastTextContent.substr(-1)) || isFirefox) {
            currentLine = currentLine.replace(/^\s+/, '');
          }
        }
        textNode.textContent = currentLine;

        p.y = rect.height * 0.5;
        p.x = rect.width > mearureTreshhold ? rect.width - mearureTreshhold : rect.width;
        lastLineIndex = hardLineIndex;

        num = textNode.getCharNumAtPosition(p);
        if (num > -1) {
          textNode.textContent = currentLine.substr(0, num + 1);
          currentLine = currentLine.substr(num + 1).replace(/\r$/,'');
        }

        textNode.setAttributeNS(null, 'x', rect.left);
        textNode.setAttributeNS(null, 'y', rect.top - Math.round(Math.min(0, textNode.getBBox().y)));

        if (num < 0 || ((isFirefox || isMSIEdge) && !currentLine)) {
          hardLineIndex += 1;
          currentLine = hardLines[hardLineIndex];
        }


        lastTop = rect.top;
        lastTextContent = textNode.textContent;
      }
    }
  }

  handeTextEditor = (ref) => {
    this.textEditor = ref;
  };

  handleTextChange = (e) => {
    this.processChange('text', e.target.innerText, true);
  };

  handleTextBlur = () => {
    this.setState({editing: false});
  };

  createEditor() {
    if (this.props.editable) {
      const props = {};
      wrapProperties.forEach((key) => {
        props[key] = this.props[key];
      });

      const bbox = this.textWrapperNode.firstChild.getBBox();
      const textBaseline = isFirefox ? bbox.y + bbox.height : Math.round(bbox.y + bbox.height);
      // console.log(bbox.y, bbox.height, textBaseline, this.state.measurement.baseline);
      const dy = Math.round(textBaseline - this.state.measurement.baseline);

      return <TextEditor
        {...props}
        key={this.id}
        ref={this.handeTextEditor}
        x={this.props.padding} y={this.props.padding + dy}
        onTextChange={this.handleTextChange}
        onBlur={this.handleTextBlur}
        width={(this.props.width || this.state.width || 0) - (this.props.padding * 2) - 0.01}
        height={(this.state.height || 0) - (this.props.padding * 2)}
        text={this.props.text} fill="blue"
      />;
    } else {
      return null;
    }
  }

  handleTextDown = (e) => {
    if (this.state.editable) {
      e.stopPropagation();
    }
    if (this.props.editable && this.context.api.isNodeSelected(this)) {
      this.textDownTime = e.timeStamp;
    }
  };

  handleTextUp = (e) => {
    if (!this.state.moving && this.props.editable && this.context.api.isNodeSelected(this)) {
      if (e.timeStamp - this.textDownTime < 200) {
        this.setState({editing: true});
      }
    }
  };

  handleTextWrapperRef = (ref) => {
    this.textWrapperNode = ref;
  };

  handleTextRect = (ref) => {
    this.textRectNode = ref;
  };

  getForm() {
    return [{
      type: 'text',
      key: 'text',
      title: 'Text'
    }, {
      type: 'number',
      key: 'fontSize',
      title: 'Font Size'
    }, {
      type: 'number',
      key: 'lineHeight',
      title: 'Line Height'
    }];
  }

  renderChildren() {
    // wrap lines
    const rects = this.state.measurement.rects;
    if (rects.length === 0) {
      return null;
    }
    let y = 2;
    const dy = 0;
    switch (this.props.verticalAlign) {
      case 'top':
        break;
      case 'bottom':
        y = -this.state.measurement.height;
        if (this.props.height) {
          y += this.props.height;
        }
        break;
      case 'middle':
        y = -this.state.measurement.height * 0.5;
        if (this.props.height) {
          y += this.props.height * 0.5;
        }
        break;
      default:
        break;
    }
    return (<g
      onTouchStart={this.handleTextDown}
      onMouseDown={this.handleTextDown}
      onMouseUp={this.handleTextUp}
      onTouchEnd={this.handleTextUp}
    >
      <rect ref={this.handleTextRect} width={this.props.width} height={this.state.measurement.height + (2 * this.props.padding)} fill="transparent"/>
      <g>
        {isDebug ? rects.map((line, i) => {
          return <rect
            key={`${i}'_'${line.left}`}
            width={line.width} height={line.height}
            x={line.left}
            y={line.top}
            fill="green"
          />;
        }) : null}
      </g>
      <g transform={`translate(${this.props.padding}, ${y})`}>
        <g ref={this.handleTextWrapperRef}>
          {rects.map((line, i) => {
            return <text
              key={`${i}'_'${line.left}`} xmlSpace="preserve" className="no-select" style={textStyle} fontFamily={this.props.fontFamily} fontSize={this.props.fontSize}
              dy="1em" y={line.top} fill={this.state.editing ? 'transparent' : this.props.fill}
            />;
          })}
        </g>
      </g>
    </g>);
  }

}


var divWrapper;
function createDivWrapper() {
  const outsideWrapper = document.createElement('div');
  outsideWrapper.style.position = 'absolute';
  outsideWrapper.style.width = '100px';
  outsideWrapper.style.height = '100px';
  outsideWrapper.style.overflow = 'hidden';
  outsideWrapper.style.zIndex = '-1';


  const ret = document.createElement('div');
  ret.style.position = 'absolute';
  ret.style.zIndex = '-1';
  ret.style.whiteSpace = 'pre-wrap';
  ret.style.wordWrap = 'break-word';
  ret.style.wordBreak = 'break-word'; // for FF
  ret.style.color = 'transparent';
  ret.style.textRendering = 'geometricPrecision';
  ret.style.padding = '0';

  outsideWrapper.appendChild(ret);
  document.body.appendChild(outsideWrapper);

  return ret;
}

const measureScaleFactor = 1;

function prepareDivWrapper(options) {
  const {text, fontSize, fontFamily, width, textAlign, lineHeight} = options;

  divWrapper = divWrapper || createDivWrapper();
  divWrapper.innerHTML = '';
  divWrapper.style.fontFamily = fontFamily;
  divWrapper.style.lineHeight = lineHeight;
  divWrapper.style.fontSize = `${fontSize * measureScaleFactor}px`;
  divWrapper.style.width = `${width * measureScaleFactor}px`;
  divWrapper.style.textAlign = textAlign;
  divWrapper.innerHTML = `<span>${text.replace(/\r?\n/gi, '<br/>')}</span>`;

  return divWrapper;
}

function preparePropsForMeasurement(props) {
  return Object.assign({}, props, {width: (props.width || 10) - (props.padding * 2)});
}

function measureText(props, withoutRects) {
  const options = preparePropsForMeasurement(props);
  divWrapper = prepareDivWrapper(options);
  const rects = divWrapper.firstChild.getClientRects();
  const topRect = divWrapper.getBoundingClientRect();
  const firstLineOffset = (rects.length ? rects[0].top - topRect.top : 0);
  const baseline = (rects.length ? rects[0].bottom - topRect.top : 0);
  // console.log(baseline / measureScaleFactor);
  return {
    height: (divWrapper.offsetHeight - (2 * firstLineOffset)) / measureScaleFactor,
    firstLineOffset: firstLineOffset / measureScaleFactor,
    baseline: baseline / measureScaleFactor,
    rects: !withoutRects ? [].map.call(rects, (rect) => {
      return {
        left: (rect.left - topRect.left) / measureScaleFactor,
        top: (rect.top - topRect.top - firstLineOffset) / measureScaleFactor,
        bottom: (rect.bottom - topRect.top) / measureScaleFactor,
        absoluteBottom: topRect.bottom / measureScaleFactor,
        width: rect.width / measureScaleFactor,
        height: rect.height / measureScaleFactor
      };
    }) : []
  };
};

function measureTextHeight(props) {
  return measureText(props, true).height;
}