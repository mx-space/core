/**
 * @copy from mongoose-lean-id
 */
export function mongooseLeanId(schema) {
  schema.post('find', attachId)
  schema.post('findOne', attachId)
  schema.post('findOneAndUpdate', attachId)
  schema.post('findOneAndReplace', attachId)
  schema.post('findOneAndDelete', attachId)
}

function attachId(res) {
  if (res == null) {
    return
  }

  function replaceId(res) {
    if (Array.isArray(res)) {
      res.forEach((v) => {
        if (!v) return
        if (isObjectId(v)) {
          return
        }
        if (v._id) {
          v.id = v._id.toString()
        }
        Object.keys(v).forEach((k) => {
          if (Array.isArray(v[k])) {
            replaceId(v[k])
          }
        })
      })
    } else {
      if (isObjectId(res)) {
        return res
      }
      if (res._id) {
        res.id = res._id.toString()
      }
      Object.keys(res).forEach((k) => {
        if (Array.isArray(res[k])) {
          replaceId(res[k])
        }
      })
    }
  }

  if (this._mongooseOptions.lean) {
    replaceId(res)
  }
}

function isObjectId(v) {
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
