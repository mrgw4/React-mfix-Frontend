import { Given, When, Then } from '@badeball/cypress-cucumber-preprocessor'

Given('the movie catalog is available', () => {
  cy.intercept({ method: 'GET', pathname: '/api/movies', query: { limit: '30' } }, {
    statusCode: 200,
    body: {
      data: [
        {
          _id: 'movie-quiet-between',
          title: 'The Quiet Between',
          year: 2025,
          genres: ['Drama', 'Mystery'],
          imdb: { rating: 8.7 },
          runtime: 114,
          fullplot: 'A story from the backend.',
          directors: ['Mara Ellison'],
          cast: ['Nina Park'],
          poster: '',
        },
        {
          _id: 'movie-after-orchard',
          title: 'After the Orchard',
          year: 2024,
          genres: ['Drama'],
          imdb: { rating: 7.2 },
          runtime: 102,
          fullplot: 'A family returns to their hometown.',
          directors: ['Theo Martin'],
          cast: ['Ari Lane'],
          poster: '',
        },
      ],
      pagination: { page: 1, limit: 30, total: 2, pages: 1 },
    },
  }).as('getMovies')
})

Given('the account API is available', () => {
  cy.intercept('POST', '/api/users', {
    statusCode: 201,
    body: { message: 'User created successfully', user: { _id: 'user-1', name: 'Jane Doe' } },
  }).as('registerUser')
  cy.intercept('POST', '/api/users/login', {
    statusCode: 200,
    body: {
      token: 'test-cypress-token',
      user: { id: 'user-1', name: 'Jane Doe', email: 'jane@example.com' },
    },
  }).as('loginUser')
})

Given('the login API rejects the credentials with an empty response', () => {
  cy.intercept('POST', '/api/users/login', {
    statusCode: 401,
    body: '',
  }).as('rejectedLogin')
})

When('I visit the movie discovery page', () => {
  cy.visit('/')
  cy.wait('@getMovies')
})

When('I search for {string}', (searchTerm: string) => {
  cy.get('[aria-label="Search movies"]').type(searchTerm)
})

When('I open the login menu', () => {
  cy.get('button[aria-label="Open login menu"]').click()
})

When('I choose to create an account', () => {
  cy.contains('button.account-switch', 'Create one').click()
})

When('I register with username {string}, email {string}, and password {string}', (
  username: string,
  email: string,
  password: string,
) => {
  cy.get('input[autocomplete="username"]').type(username)
  cy.get('input[autocomplete="email"]').type(email)
  cy.get('input[autocomplete="new-password"]').first().type(password)
  cy.get('input[autocomplete="new-password"]').last().type(password)
  cy.contains('button.account-action', 'Create account').click()
  cy.wait('@registerUser').then(({ request }) => {
    expect(request.body).to.deep.equal({ name: username, email, password })
  })
})

When('I register with a mismatched password confirmation', () => {
  cy.get('input[autocomplete="username"]').type('Jane Doe')
  cy.get('input[autocomplete="email"]').type('jane@example.com')
  cy.get('input[autocomplete="new-password"]').first().type('correct-password')
  cy.get('input[autocomplete="new-password"]').last().type('different-password')
  cy.contains('button.account-action', 'Create account').click()
})

When('I log in with the registered credentials', () => {
  cy.get('input[autocomplete="current-password"]').type('correct-password')
  cy.contains('button.account-action', 'Log in').click()
  cy.wait('@loginUser').then(({ request }) => {
    expect(request.body).to.deep.equal({ email: 'jane@example.com', password: 'correct-password' })
  })
})

When('I log in with invalid credentials', () => {
  cy.get('input[autocomplete="email"]').type('jane@example.com')
  cy.get('input[autocomplete="current-password"]').type('wrong-password')
  cy.contains('button.account-action', 'Log in').click()
  cy.wait('@rejectedLogin')
})

Then('I should see the movie {string}', (title: string) => {
  cy.contains('.movie-card .movie-title', title).should('be.visible')
})

Then('I should not see the movie {string}', (title: string) => {
  cy.contains('.movie-card .movie-title', title).should('not.exist')
})

Then('I should be returned to the login form with a success message', () => {
  cy.get('[role="status"]').should('contain.text', 'Account created successfully. Please log in.')
  cy.get('input[autocomplete="email"]').should('have.value', 'jane@example.com')
  cy.get('input[autocomplete="current-password"]').should('be.visible')
})

Then('I should be logged in as {string}', (username: string) => {
  cy.get('.account-heading strong').should('have.text', username)
  cy.window().then((window) => {
    expect(window.localStorage.getItem('mosaic.auth.v1')).to.contain('test-cypress-token')
  })
})

Then('I should see a password mismatch error', () => {
  cy.get('[role="alert"]').should('contain.text', 'Passwords do not match.')
})

Then('no registration request should be sent', () => {
  cy.get('@registerUser.all').should('have.length', 0)
})

Then('I should see the credential error above the email field', () => {
  cy.get('.account-form').then(($form) => {
    const error = $form.find('[role="alert"]')
    const emailLabel = $form.find('label').first()
    expect(error).to.contain.text('Invalid username or password.')
    expect($form.children().index(error)).to.be.lessThan($form.children().index(emailLabel))
  })
})
