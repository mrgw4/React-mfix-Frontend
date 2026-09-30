import { Given, When, Then } from '@badeball/cypress-cucumber-preprocessor'

Given('the movie catalog is available', () => {
  cy.intercept('GET', '/api/movies?limit=30', {
    statusCode: 200,
    body: [],
  }).as('getMovies')
})

When('I visit the movie discovery page', () => {
  cy.visit('/')
  cy.wait('@getMovies')
})

When('I search for {string}', (searchTerm: string) => {
  cy.get('[aria-label="Search movies"]').type(searchTerm)
})

Then('I should see the movie {string}', (title: string) => {
  cy.contains('.movie-card .movie-title', title).should('be.visible')
})

Then('I should not see the movie {string}', (title: string) => {
  cy.contains('.movie-card .movie-title', title).should('not.exist')
})