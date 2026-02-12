// Adapted from mongoose-lean-id
export function mongooseLeanId(schema: any) {
  schema.post('find', attachId)
  schema.post('findOne', attachId)
  schema.post('findOneAndUpdate', attachId)
  schema.post('findOneAndReplace', attachId)
  schema.post('findOneAndDelete', attachId)
}

function replaceId(res: any) {
  if (Array.isArray(res)) {
    for (const item of res) {
      if (!item || isObjectId(item)) continue
      if (item._id) {
        item.id = item._id.toString()
      }
      for (const key of Object.keys(item)) {
        if (Array.isArray(item[key])) {
          replaceId(item[key])
        }
      }
    }
    return
  }

  if (isObjectId(res)) return

  if (res._id) {
    res.id = res._id.toString()
  }
  for (const key of Object.keys(res)) {
    if (Array.isArray(res[key])) {
      replaceId(res[key])
    }
  }
}

function attachId(this: any, res: any) {
  if (res == null) {
    return
  }
  if (this._mongooseOptions.lean) {
    replaceId(res)
  }
}

function isObjectId(v: any) {
  if (v == null) {
    return false
  }
  const proto = Object.getPrototypeOf(v)
  if (
    proto == null ||
    proto.constructor == null ||
    proto.constructor.name !== 'ObjectId'
  ) {
    return false
  }
  return v._bsontype === 'ObjectId'
}
