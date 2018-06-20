import chai from 'chai'
import HttpStatus from 'http-status-codes'
import request from 'supertest'
import jest from 'jest'

import app from '../app'

jest.mock('web3', () => require.requireActual('./__mocks__/web3').default)

const { expect } = chai.expect

describe('Network API', () => {

    beforeEach(() => {

    })

    it('returns swagger docs successfully', async () => {
        const r = await request(app).get('/')
        expect(r.status).to.equal(HttpStatus.OK)
    })
})
