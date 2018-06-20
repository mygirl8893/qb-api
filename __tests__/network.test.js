import chai from 'chai'
import HttpStatus from 'http-status-codes'
import request from 'supertest'

import app from '../app'

const { expect } = chai

describe('Network API', () => {

    it('returns swagger docs successfully', async () => {
        const r = await request(app).get('/')
        expect(r.status).to.equal(HttpStatus.OK)
    })
})
