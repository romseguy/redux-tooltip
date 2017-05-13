import isDOM from 'is-dom';
import * as actions from './actions';

function dimension(el) {
  const rect = el.getBoundingClientRect();
  return { width: rect.width, height: rect.height };
}

/**
 * Returns a position of given DOM element.
 *
 * @param {Object} el - DOM element.
 * @return {Object}
 */
export function position(el) {
  const pos = el ? el.getBoundingClientRect() : {};
  const { pageYOffset, pageXOffset } = window;
  const { scrollTop, clientTop, scrollLeft, clientLeft } = document.documentElement;
  const winTop = (pageYOffset || scrollTop) - clientTop;
  const winLeft = (pageXOffset || scrollLeft) - clientLeft;

  return {
    top: pos.top + winTop,
    left: pos.left + winLeft,
    right: pos.right + winLeft,
    bottom: pos.bottom + winTop,
    width: pos.width,
    height: pos.height,
  };
}

/**
 * Calculates a position of the tooltip.
 *
 * @param {string} place - 'top', 'right', 'bottom', or 'left'.
 * @param {Object} content - DOM element that contains a content.
 * @param {Object} origin - DOM element, element id or position object.
 * @return {Object} contains 'top', 'left', and extra keys.
 */
export function placement(place, content, origin) {
  const gap = 12;
  const dim = dimension(content);
  let pos = { top: origin.y, right: origin.x, bottom: origin.y, left: origin.x, width: 0, height: 0 }

  if (isDOM(origin)) {
    pos = position(origin)
  } else if (typeof origin === 'string') {
    pos = position(document.getElementById(origin))
  }

  let offset = { width: dim.width, height: dim.height };
  switch(place) {
  case 'top': case 'bottom':
    offset.left = `${pos.left + (pos.width * 0.5) - (dim.width * 0.5)}px`;
    break;
  case 'left': case 'right':
    offset.top = `${pos.top + (pos.height * 0.5) - (dim.height * 0.5)}px`;
    break;
  }

  switch(place) {
  case 'top':
    offset.top = `${pos.top - dim.height - gap}px`;
    break;
  case 'right':
    offset.left = `${pos.right + gap}px`;
    break;
  case 'bottom':
    offset.top = `${pos.top + pos.height + gap}px`;
    break;
  case 'left':
    offset.left = `${pos.left - dim.width - gap}px`;
    break;
  }

  return offset;
}

/**
 * Completes missing directions in given direction(s).
 *
 * @param {string|Array} dir - a direction or a list of directions.
 * @return {Array}
 */
const DIRS = ['top', 'right', 'bottom', 'left'];
export function complete(dir) {
  if (typeof dir === 'string') {
    dir = [dir];
  } else {
    dir = [...dir];
  }

  const missings = DIRS.filter(d => dir.indexOf(d) === -1);
  return dir.concat(missings);
}

/**
 * Calculates an intersection of two areas.
 *
 * @param {Object} area1
 * @param {Object} area2
 * @return {Object} an intersection.
 */
export function intersection(area1, area2) {
  let area = {};
  area.top = Math.max(area1.top, area2.top);
  area.right = Math.min(area1.left + area1.width, area2.left + area2.width);
  area.bottom = Math.min(area1.top + area1.height, area2.top + area2.height);
  area.left = Math.max(area1.left, area2.left);
  area.height = area.bottom - area.top;
  area.width = area.right - area.left;
  return area;
}

function scrollOffset() {
  const list = [document.documentElement, document.body.parentNode, document.body];
  return {
    top: list.map(el => el.scrollTop).reduce((p, v) => p || v),
    left: list.map(el => el.scrollLeft).reduce((p, v) => p || v),
  };
}

// Returns current content area
function contentArea() {
  return {
    ...scrollOffset(),
    height: window.innerHeight,
    width: window.innerWidth,
  };
}

// Strip unit string from property values and convert to float
const STRIP_FOR = ['top', 'left', 'right', 'bottom', 'width', 'height'];
export function strip(obj) {
  const data = { ...obj };
  STRIP_FOR.forEach(prop => {
    if (typeof data[prop] === 'string') {
      data[prop] = parseFloat(data[prop].replace('px', ''));
    }
  });
  return data;
}

// Make full area data from minimum data
export function amend(area) {
  const data = strip(area);
  if (typeof data.top !== 'number') {
    data.top = 0;
  }
  if (typeof data.left !== 'number') {
    data.left = 0;
  }
  if (typeof data.right !== 'number' && typeof data.width === 'number') {
    data.right = data.left + data.width;
  }
  if (typeof data.bottom !== 'number' && typeof data.height === 'number') {
    data.bottom = data.top + data.height;
  }
  return data;
}

// Returns directions which are not in target rectangle
export function overDirs(tip, el) {
  tip = amend(tip);
  let area = amend(contentArea());
  if (el && typeof el === 'object') {
    area = intersection(area, position(el));
  }

  const dirs = [];
  if (tip.top < area.top) {
    dirs.push('top');
  }
  if (area.right < tip.right) {
    dirs.push('right');
  }
  if (area.bottom < tip.bottom) {
    dirs.push('bottom');
  }
  if (tip.left < area.left) {
    dirs.push('left');
  }

  return dirs;
}

/**
 * Places and adjusts a tooltip.
 *
 * @param {Object} content - DOM element which contans a content.
 * @param {Object} props - props set from Tooltip component.
 * @return {Object} 'offset': style data to locate, 'place': final direction of the tooltip
 */
export function adjust(content, props) {
  const { auto, within } = props;
  const origin = originOrEl(props);
  let { place } = props;
  if (typeof place === 'string') {
    place = place.split(',').map(p => p.trim());
  }
  if (auto) {
    place = complete(place);
  }

  let pos, dirs, current, first;
  const tries = [ ...place ];
  while (0 < tries.length) {
    current = tries.shift();
    pos = placement(current, content, origin);
    if (typeof first === 'undefined') {
      first = { offset: pos, place: current };
    }
    dirs = overDirs(pos, within && within());
    if (dirs.length === 0) {
      return { offset: pos, place: current };
    }
  }
  return first;
}

/**
 * Resolves names of target tooltip from action or props.
 *
 * @param {Object} action or props.
 * @return {Array} a list of tooltip names.
 */
export function resolve(obj) {
  let names;
  if (obj && obj.payload && obj.payload.name) {
    names = obj.payload.name;
  } else if (obj && obj.name) {
    names = obj.name;
  } else {
    names = ['default'];
  }

  if (typeof names === 'string') {
    names = [names];
  }

  return names;
}

const actionTypes = Object.keys(actions).map(k => actions[k]).filter(e => typeof e === 'string');
export function deprecatedWarning(action) {
  const { type, payload } = action;
  if (actionTypes.indexOf(action.type) === -1) {
    return; // Ignore non-related actions
  }
  if (payload && payload.el) {
    console.warn(`DEPRECATED: Use 'origin' instead of 'el' in props for Tooltip component or 'show' action.`);
  }
  if (payload && payload.el && payload.origin) {
    console.warn(`Do not pass both 'origin' and 'el' props at the same time.`);
  }
}

export function originOrEl(props) {
  return props.origin || props.el;
}
