import { mockRequestInstance } from '~/__tests__/helpers/instance'
import { mockResponse } from '~/__tests__/helpers/response'
import { axiosAdaptor } from '~/adaptors/axios'
import { NoteController } from '~/controllers'
import { RequestError } from '~/core'
import { vi } from 'vitest'

const { spyOn } = vi

describe('test note client', () => {
  const client = mockRequestInstance(NoteController)

  it('should get note list', async () => {
    mockResponse('/notes', {
      data: [],
      pagination: {},
    })

    const data = await client.note.getList()
    expect(data).toEqual({ data: [], pagination: {} })
  })

  it('should get post list filter filed', async () => {
    const mocked = mockResponse('/notes?page=1&size=1&select=created+title', {
      data: [{}],
    })

    const data = await client.note.getList(1, 1, {
      select: ['created', 'title'],
    })
    expect(data).toEqual(mocked)
  })

  it('should get latest note', async () => {
    mockResponse('/notes/latest', { data: { title: '1' } })
    const data = await client.note.getLatest()
    expect(data.data.title).toBe('1')
  })

  it('should get middle list of note', async () => {
    mockResponse('/notes/list/1', {
      data: [
        {
          id: '1',
        },
        {
          id: '2',
        },
      ],
      size: 2,
    })
    const data = await client.note.getMiddleList('1')
    expect(data).toEqual({
      data: [
        {
          id: '1',
        },
        {
          id: '2',
        },
      ],
      size: 2,
    })
  })

  it('should get single note', async () => {
    mockResponse('/notes/1', { title: '1' })

    const data = await client.note.getNoteById('1')

    expect(data).toStrictEqual({ title: '1' })
    expect(data.$raw).toBeDefined()
  })

  it('should get note by nid', async () => {
    mockResponse('/notes/nid/1', { data: { title: '1' } })

    const data = await client.note.getNoteById(1)
    expect(data.data.title).toBe('1')
  })

  it('should get note by nid query single result', async () => {
    mockResponse('/notes/nid/1', { title: '1' })

    const data = await client.note.getNoteById(1, undefined, true)
    expect(data.title).toBe('1')
  })

  it('should forbidden if no password provide', async () => {
    spyOn(axiosAdaptor, 'get').mockRejectedValue({
      response: {
        data: {
          message: 'password required',
        },
        status: 403,
      },
    })

    await expect(client.note.getNoteById('1')).rejects.toThrowError(
      RequestError,
    )
  })

  test('GET /notes/topics/:id', async () => {
    mockResponse('/notes/topics/11111111', { data: [], pagination: {} })

    const data = await client.note.getNoteByTopicId('11111111')

    expect(data).toEqual({ data: [], pagination: {} })
  })
})
