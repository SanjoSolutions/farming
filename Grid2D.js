export class Grid2D {
  constructor(width, height) {
    this.width = width
    this.height = height
    this._values = new Array(height * width)
  }

  get({ row, column }) {
    return this._values[this._getIndex({ row, column })]
  }

  set({ row, column }, value) {
    this._values[this._getIndex({ row, column })] = value
  }

  _getIndex({ row, column }) {
    return row * this.width + column
  }
}
