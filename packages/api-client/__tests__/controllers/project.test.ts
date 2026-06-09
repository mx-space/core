import { mockRequestInstance } from '~/__tests__/helpers/instance'
import { mockResponse } from '~/__tests__/helpers/response'
import { ProjectController } from '~/controllers/project'

describe('test project client', () => {
  const client = mockRequestInstance(ProjectController)

  it('should get paginated list', async () => {
    mockResponse('/projects?page=1&size=10', {
      data: [],
      pagination: { page: 1, size: 10, total: 0, total_pages: 0 },
    })
    const data = await client.project.getAllPaginated(1, 10)
    expect(data.data).toEqual([])
    expect(data.pagination).toEqual({
      page: 1,
      size: 10,
      total: 0,
      totalPages: 0,
    })
  })

  it('should get all', async () => {
    mockResponse('/projects/all', [{ id: '1', name: 'a' }])
    const data = await client.project.getAll()
    expect(data).toEqual([{ id: '1', name: 'a' }])
  })

  it('should get one by id', async () => {
    mockResponse('/projects/1', { id: '1', name: 'a' })
    const data = await client.project.getById('1')
    expect(data.id).toBe('1')
    expect(data.$raw).toBeDefined()
  })

  it('should create with input body', async () => {
    const body = { name: 'kami', description: 'k' }
    mockResponse('/projects', { id: '99', ...body }, 'post', body)
    const data = await client.project.create(body)
    expect(data).toMatchObject({ id: '99', name: 'kami' })
  })

  it('should patch with partial body', async () => {
    const body = { description: 'updated' }
    mockResponse(
      '/projects/99',
      { id: '99', name: 'kami', description: 'updated' },
      'patch',
      body,
    )
    const data = await client.project.update('99', body)
    expect(data.description).toBe('updated')
  })

  it('should delete by id', async () => {
    mockResponse('/projects/99', { id: '99' }, 'delete')
    const data = await client.project.delete('99')
    expect(data.id).toBe('99')
  })
})
