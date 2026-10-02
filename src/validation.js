// Returns true when a task title is a non-empty string
function isValidTitle(title) {
  return typeof title === 'string' && title.trim().length > 0;
}

module.exports = { isValidTitle };
