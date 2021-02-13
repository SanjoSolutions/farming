import { Grid2D } from './Grid2D.js'

class Farm {
  constructor(width, height) {
    this.width = width
    this.height = height
    this.land = new Grid2D(width, height)
    for (let row = 1; row <= height; row++) {
      for (let column = 1; column <= width; column++) {
        const field = new Field(row, column)
        this.land.set({ row, column }, field)
      }
    }
  }
}

const FIELD_WIDTH = 32
const FIELD_HEIGHT = 32

const FieldState = {
  Plowed: 0b1,
  Planted: 0b10,
  Watered: 0b100,
}

const WorkType = {
  Plow: 1,
  Plant: 2,
  Water: 3,
  Harvest: 4,
}

class Field {
  constructor(row, column) {
    this.row = row
    this.column = column
    this.state = 0
    this.plantedAt = null
    this.assignedFarmer = null
  }

  assignFarmer(farmer) {
    this.assignedFarmer = farmer
  }

  unassignFarmer() {
    this.assignedFarmer = null
  }

  canWorkBeDone() {
    return (
      !this.assignedFarmer &&
      (
        this.canBePlowed() ||
        this.canBePlanted() ||
        this.canBeWatered() ||
        this.canBeHarvested()
      )
    )
  }

  getNextWorkTypeThatCanBeDone() {
    if (this.canBePlowed()) {
      return WorkType.Plow
    } else if (this.canBePlanted()) {
      return WorkType.Plant
    } else if (this.canBeWatered()) {
      return WorkType.Water
    } else if (this.canBeHarvested()) {
      return WorkType.Harvest
    } else {
      return null
    }
  }

  canBePlowed() {
    return !this.isPlowed()
  }

  canBePlanted() {
    return this.isPlowed() && !this.isPlanted()
  }

  canBeWatered() {
    return this.isPlowed() && !this.isWatered()
  }

  getGrowProgress() {
    let progress
    if (this.isPlanted()) {
      const passedTime = new Date() - this.plantedAt
      const numberOfStages = 4
      const durationPerStage = 60000
      const totalDuration = numberOfStages * durationPerStage
      progress = Math.min(passedTime / totalDuration, 1)
    } else {
      progress = 0
    }
    return progress
  }

  canBeHarvested() {
    return (
      this.isPlanted() &&
      this.getGrowProgress() === 1
    )
  }

  isPlowed() {
    return (this.state & FieldState.Plowed) === FieldState.Plowed
  }

  isPlanted() {
    return (this.state & FieldState.Planted) === FieldState.Planted
  }

  isWatered() {
    return (this.state & FieldState.Watered) === FieldState.Watered
  }

  plow() {
    if (this.canBePlowed()) {
      this.state |= FieldState.Plowed
    }
  }

  plant() {
    if (this.canBePlanted()) {
      this.state |= FieldState.Planted
      this.plantedAt = new Date()
    }
  }

  water() {
    if (this.canBeWatered()) {
      this.state |= FieldState.Watered
    }
  }

  harvest() {
    const allStates = FieldState.Plowed | FieldState.Planted | FieldState.Watered
    this.state &= allStates ^ FieldState.Planted
    this.plantedAt = null
  }
}

class Farmer {
  constructor(position) {
    this.position = position
    this._task = null
  }

  isIdle() {
    return !this._task
  }

  hasTask() {
    return Boolean(this._task)
  }

  doTask(workType, field) {
    const workTypeToMethod = new Map([
      [WorkType.Plow, this.plowField],
      [WorkType.Plant, this.plantCrop],
      [WorkType.Water, this.waterField],
      [WorkType.Harvest, this.harvestPlant],
    ])
    if (workTypeToMethod.has(workType)) {
      const method = workTypeToMethod.get(workType)
      method.call(this, field)
    } else {
      throw new Error(`No method for work type "${workType}".`)
    }
  }

  act() {
    const stepDistance = 0.025
    if (this.hasTask()) {
      if (Math.abs(this._task.field.row - this.position.row) > stepDistance) {
        if (this._task.field.row < this.position.row) {
          this.position.row -= stepDistance
        } else {
          this.position.row += stepDistance
        }
      } else if (
        Math.abs(this._task.field.column - this.position.column) > stepDistance
      ) {
        if (this._task.field.column < this.position.column) {
          this.position.column -= stepDistance
        } else {
          this.position.column += stepDistance
        }
      } else {
        const workTypeToMethodName = new Map([
          [WorkType.Plow, 'plow'],
          [WorkType.Plant, 'plant'],
          [WorkType.Water, 'water'],
          [WorkType.Harvest, 'harvest']
        ])
        const workType = this._task.workType
        const field = this._task.field
        if (workTypeToMethodName.has(workType)) {
          const methodName = workTypeToMethodName.get(workType)
          field[methodName]()
        }
        field.unassignFarmer()
        this._unassignTask()
      }
    }
  }

  _unassignTask() {
    this._task = null
  }

  plowField(field) {
    if (field.canBePlowed()) {
      this._setTask(WorkType.Plow, field)
    }
  }

  plantCrop(field) {
    if (field.canBePlanted()) {
      this._setTask(WorkType.Plant, field)
    }
  }

  waterField(field) {
    if (field.canBeWatered()) {
      this._setTask(WorkType.Water, field)
    }
  }

  harvestPlant(field) {
    if (field.canBeHarvested()) {
      this._setTask(WorkType.Harvest, field)
    }
  }

  _setTask(workType, field) {
    this._task = {
      workType,
      field,
    }
    field.assignFarmer(this)
  }
}

class Coordinator {
  constructor(farm, farmers) {
    this._farm = farm
    this._farmers = farmers
  }

  coordinate() {
    const idleFarmers = this._getIdleFarmers()
    for (const farmer of idleFarmers) {
      const field = this._getClosestFieldToWorkOn(farmer)
      if (field) {
        const workType = field.getNextWorkTypeThatCanBeDone()
        farmer.doTask(workType, field)
      }
    }
  }

  _getIdleFarmers() {
    return this._farmers.filter(farmer => farmer.isIdle())
  }

  _getClosestFieldToWorkOn(farmer) {
    const farmerPosition = {
      row: Math.round(farmer.position.row),
      column: Math.round(farmer.position.column)
    }
    const maximumDistance = Math.max(
      calculateFarmerWalkDistance(farmer, { row: 1, column: 1 }),
      calculateFarmerWalkDistance(farmer, { row: 1, column: this._farm.width }),
      calculateFarmerWalkDistance(farmer, { row: this._farm.height, column: 1 }),
      calculateFarmerWalkDistance(
        farmer,
        { row: this._farm.height, column: this._farm.width },
      ),
    )
    for (let distance = 0; distance <= maximumDistance; distance++) {
      for (
        let row = Math.max(farmerPosition.row - distance, 1);
        row <= Math.min(farmerPosition.row + distance, this._farm.height);
        row++
      ) {
        const distanceLeft = distance - Math.abs(row - farmerPosition.row)
        for (
          let column = Math.max(farmerPosition.column - distanceLeft, 1);
          column <= Math.min(farmerPosition.column + distanceLeft, this._farm.width);
          column++
        ) {
          const field = this._farm.land.get({ row, column })
          if (field.canWorkBeDone()) {
            return field
          }
        }
      }
    }

    return null
  }
}

function calculateFarmerWalkDistance(farmer, destination) {
  return (
    Math.abs(destination.row - Math.round(farmer.position.row)) +
    Math.abs(destination.column - Math.round(farmer.position.column))
  )
}

function main() {
  const farm = new Farm(20, 10)
  const NUMBER_OF_FARMERS = 3
  const farmers = []
  for (let index = 0; index < NUMBER_OF_FARMERS; index++) {
    const position = { row: farm.height, column: 1 + index }
    const farmer = new Farmer(position)
    farmers.push(farmer)
  }
  const coordinator = new Coordinator(farm, farmers)

  // rendering
  const canvas = document.createElement('canvas')
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  document.body.appendChild(canvas)
  const context = canvas.getContext('2d')

  function onTick() {
    act()
    coordinator.coordinate()
    render()

    scheduleNextTick()
  }

  function act() {
    farmers.forEach(farmer => farmer.act())
  }

  function render() {
    renderFarm()
    renderFields()
    renderFarmers()
  }

  function renderFarm() {
    context.fillStyle = '#fddd7d'
    context.fillRect(
      0,
      0,
      farm.width * FIELD_WIDTH,
      farm.height * FIELD_HEIGHT
    )
  }

  function renderFields() {
    const land = farm.land
    for (let row = 1; row <= land.height; row++) {
      for (let column = 1; column <= land.width; column++) {
        const field = land.get({ row, column })
        renderField(field)
      }
    }
  }

  function renderField(field) {
    if (field.isPlowed()) {
      renderPlowedArea(field)
    }
    if (field.isPlanted()) {
      renderPlant(field)
    }
  }

  function renderPlowedArea(field) {
    let lightness
    if (field.isWatered()) {
      lightness = 44
    } else {
      lightness = 61
    }
    context.fillStyle = `hsl(45deg 43% ${lightness}%)`
    const plowedAreaLength = 0.8
    context.fillRect(
      (field.column - 1) * FIELD_WIDTH + ((1 - plowedAreaLength) / 2 * FIELD_WIDTH),
      (field.row - 1) * FIELD_HEIGHT + ((1 - plowedAreaLength) / 2 * FIELD_HEIGHT),
      plowedAreaLength * FIELD_WIDTH,
      plowedAreaLength * FIELD_HEIGHT,
    )
  }

  function renderPlant(field) {
    context.strokeStyle = 'hsl(122deg 39% 69%)'
    context.fillStyle = 'hsl(122deg 39% 49%)'
    const plantWidth = 0.6
    const plantMinHeight = 0.6
    const plantMaxHeight = 3 * plantMinHeight
    const plantHeight = plantMinHeight +
      field.getGrowProgress() * (plantMaxHeight - plantMinHeight)
    context.beginPath()
    context.rect(
      (field.column - 1) * FIELD_WIDTH + ((1 - plantWidth) / 2 * FIELD_WIDTH),
      (field.row) *
      FIELD_HEIGHT -
      ((1 - plantMinHeight) / 2 * FIELD_HEIGHT) -
      plantHeight *
      FIELD_HEIGHT,
      plantWidth * FIELD_WIDTH,
      plantHeight * FIELD_HEIGHT,
    )
    context.fill()
    context.stroke()
  }

  function renderFarmers() {
    farmers.forEach(renderFarmer)
  }

  function renderFarmer(farmer) {
    context.fillStyle = '#03a9f4'
    const farmerLength = 0.5
    context.fillRect(
      (farmer.position.column - 1) * FIELD_WIDTH + ((1 - farmerLength) / 2 * FIELD_WIDTH),
      (farmer.position.row - 1) * FIELD_HEIGHT + ((1 - farmerLength) / 2 * FIELD_HEIGHT),
      farmerLength * FIELD_WIDTH,
      farmerLength * FIELD_HEIGHT,
    )
  }

  function scheduleNextTick() {
    requestAnimationFrame(onTick)
  }

  scheduleNextTick()
}

main()
