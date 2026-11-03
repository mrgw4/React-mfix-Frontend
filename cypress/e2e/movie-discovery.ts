import { Given, When, Then } from '@badeball/cypress-cucumber-preprocessor'

const catalogMovies = [
  {
    _id: 'movie-quiet-between',
    title: 'The Quiet Between',
    year: 2025,
    genres: ['Drama', 'Mystery'],
    imdb: { rating: 8.7 },
    runtime: 114,
    plot: 'A story from the backend.',
    fullplot: 'A story from the backend.',
    directors: ['Mara Ellison'],
    cast: ['Nina Park'],
    rated: 'PG-13',
    type: 'movie',
    metacritic: 90,
    released: '2025-03-14',
    tomatoes: { viewer: { meter: 91, rating: 4.2 } },
    poster: '',
  },
  {
    _id: 'movie-after-orchard',
    title: 'After the Orchard',
    year: 2024,
    genres: ['Drama'],
    imdb: { rating: 7.2 },
    runtime: 102,
    plot: 'A family returns to their hometown.',
    fullplot: 'A family returns to their hometown.',
    directors: ['Theo Martin'],
    cast: ['Ari Lane'],
    rated: 'PG',
    type: 'movie',
    metacritic: 70,
    released: '2024-06-08',
    tomatoes: { viewer: { meter: 75, rating: 3.8 } },
    poster: '',
  },
  {
    _id: 'movie-distant-voice',
    title: 'A Distant Voice',
    year: 2000,
    genres: ['Drama', 'Documentary'],
    imdb: { rating: 8.8 },
    runtime: 120,
    plot: 'A story from the backend.',
    fullplot: 'A story from the backend.',
    directors: ['Mara Ellison'],
    cast: ['Nina Park'],
    rated: 'PG-13',
    type: 'movie',
    metacritic: 85,
    released: '2000-09-21',
    tomatoes: { viewer: { meter: 88, rating: 4.1 } },
    poster: '',
  },
]

let watchlistForNextVisit: string[] | null = null

function queryValue(query: Record<string, unknown>, key: string): string {
  const value = query[key]
  return Array.isArray(value) ? String(value[0] ?? '') : String(value ?? '')
}

function matchesText(value: string, search: string): boolean {
  return value.toLowerCase().includes(search.toLowerCase())
}

function getCatalogResponse(query: Record<string, unknown>) {
  const search = queryValue(query, 'search').trim()
  const genres = queryValue(query, 'genres').split(',').filter(Boolean)
  let movies = catalogMovies.filter((movie) => {
    if (search && !matchesText(
      [movie.title, ...movie.directors, ...movie.genres].join(' '),
      search,
    )) return false
    if (genres.some((genre) => !movie.genres.includes(genre))) return false
    if (queryValue(query, 'title') && !matchesText(movie.title, queryValue(query, 'title'))) return false
    if (queryValue(query, 'plot') && !matchesText(movie.plot, queryValue(query, 'plot'))) return false
    if (queryValue(query, 'directors')
      && !movie.directors.some((director) => director.toLowerCase() === queryValue(query, 'directors').toLowerCase())) return false
    if (queryValue(query, 'cast')
      && !movie.cast.some((castMember) => castMember.toLowerCase() === queryValue(query, 'cast').toLowerCase())) return false
    if (queryValue(query, 'rated') && movie.rated.toLowerCase() !== queryValue(query, 'rated').toLowerCase()) return false
    if (queryValue(query, 'type') && movie.type.toLowerCase() !== queryValue(query, 'type').toLowerCase()) return false

    const ranges: Array<[string, string, number]> = [
      ['yearMin', 'yearMax', movie.year],
      ['runtimeMin', 'runtimeMax', movie.runtime],
      ['imdbRatingMin', 'imdbRatingMax', movie.imdb.rating],
      ['metacriticMin', 'metacriticMax', movie.metacritic],
    ]
    return ranges.every(([minKey, maxKey, value]) => {
      const minimum = queryValue(query, minKey)
      const maximum = queryValue(query, maxKey)
      return (!minimum || value >= Number(minimum))
        && (!maximum || value <= Number(maximum))
    })
  })

  const sort = queryValue(query, 'sort')
  const order = queryValue(query, 'order') === 'asc' ? 1 : -1
  movies = [...movies].sort((first, second) => {
    const firstValue = sort === 'imdbRating' ? first.imdb.rating
      : sort === 'runtime' ? first.runtime
        : sort === 'metacritic' ? first.metacritic
          : sort === 'title' ? first.title
            : first.year
    const secondValue = sort === 'imdbRating' ? second.imdb.rating
      : sort === 'runtime' ? second.runtime
        : sort === 'metacritic' ? second.metacritic
          : sort === 'title' ? second.title
            : second.year
    if (typeof firstValue === 'string' && typeof secondValue === 'string') {
      return firstValue.localeCompare(secondValue) * order
    }
    return (Number(firstValue) - Number(secondValue)) * order
  })

  const page = Math.max(Number(queryValue(query, 'page')) || 1, 1)
  const limit = Math.max(Number(queryValue(query, 'limit')) || 30, 1)
  const pages = Math.ceil(movies.length / limit)
  return {
    data: movies.slice((page - 1) * limit, page * limit),
    pagination: {
      page,
      limit,
      total: movies.length,
      pages,
      hasNextPage: page < pages,
      hasPrevPage: page > 1,
    },
  }
}

Given('the movie catalog is available', () => {
  cy.intercept({ method: 'GET', pathname: '/api/movies/genres' }, {
    statusCode: 200,
    body: { genres: ['Drama', 'Mystery', 'Documentary'] },
  }).as('getGenres')
  cy.intercept({
    method: 'GET',
    pathname: /^\/api\/movies\/(?!genres$)[^/]+$/,
  }, (request) => {
    const id = request.url.split('/').pop()?.split('?')[0] ?? ''
    const movie = catalogMovies.find((entry) => entry._id === id) ?? catalogMovies[0]
    request.reply({
      statusCode: 200,
      body: {
        ...movie,
        _id: id,
        title: id.startsWith('watchlist-') ? `Film ${id}` : movie.title,
      },
    })
  }).as('getMovie')
  cy.intercept({ method: 'GET', pathname: '/api/movies' }, (request) => {
    request.reply({ statusCode: 200, body: getCatalogResponse(request.query) })
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
  cy.intercept('POST', '/api/users/logout', {
    statusCode: 200,
    body: { message: 'Logged out successfully' },
  }).as('logoutUser')
})

Given('two distinct accounts are available', () => {
  cy.intercept('POST', '/api/users/login', (request) => {
    const email = (request.body as { email?: string }).email
    const account = email === 'jane@example.com'
      ? { id: 'user-1', name: 'Jane Doe', email }
      : email === 'alex@example.com'
        ? { id: 'user-2', name: 'Alex Lee', email }
        : null
    request.reply(account
      ? {
          statusCode: 200,
          body: { token: `token-${account.id}`, user: account },
        }
      : { statusCode: 401, body: { error: 'Invalid credentials.' } })
  }).as('isolatedLogin')
  cy.intercept('POST', '/api/users/logout', {
    statusCode: 200,
    body: { message: 'Logged out successfully' },
  }).as('logoutUser')
})

Given('the login API rejects the credentials with an empty response', () => {
  cy.intercept('POST', '/api/users/login', {
    statusCode: 401,
    body: '',
  }).as('rejectedLogin')
})

Given('the guest watchlist is preloaded with 31 movies', () => {
  watchlistForNextVisit = Array.from({ length: 31 }, (_, index) => `watchlist-${index}`)
})

When('I visit the movie discovery page', () => {
  const savedMovies = watchlistForNextVisit
  watchlistForNextVisit = null
  if (savedMovies) {
    cy.visit('/', {
      onBeforeLoad(window) {
        window.localStorage.setItem('mosaic.watchlist.v1.guest', JSON.stringify(savedMovies))
      },
    })
  } else {
    cy.visit('/')
  }
  cy.wait('@getMovies')
})

When('I search for {string}', (searchTerm: string) => {
  cy.get('[aria-label="Search movies"]').type(searchTerm)
  cy.wait('@getMovies')
})

When('I choose the genres {string} and {string}', (firstGenre: string, secondGenre: string) => {
  cy.get('[aria-label="Filter movies by genre"]').contains('button', firstGenre).click()
  cy.wait('@getMovies')
  cy.get('[aria-label="Filter movies by genre"]').contains('button', secondGenre).click()
  cy.wait('@getMovies')
})

When('I open advanced search', () => {
  cy.contains('button.advanced-search-toggle', 'Advanced search').click()
})

When('I set the advanced search field {string} to {string}', (field: string, value: string) => {
  if (
    field.startsWith('Release year')
    || field.startsWith('Minimum ')
    || field.startsWith('Maximum ')
  ) {
    cy.get(`.advanced-search-panel [aria-label="${field}"]`).type(value)
    return
  }
  cy.get('.advanced-search-panel').contains('label', field).find('input').type(value)
})

When('I apply advanced filters', () => {
  cy.contains('button', 'Apply filters').click()
  cy.wait('@getMovies')
})

When('I note the current movie request count', () => {
  cy.get('@getMovies.all').its('length').as('movieRequestCountBeforeSubmit')
})

When('I clear advanced filters', () => {
  cy.contains('button', 'Clear filters').click()
  cy.wait('@getMovies')
})

When('I sort films by {string} in {string} order', (sort: string, order: string) => {
  cy.get('[aria-label="Sort films"]').select(sort)
  cy.wait('@getMovies')
  cy.get('[aria-label="Sort direction"]').select(order)
  cy.wait('@getMovies')
})

When('I save {string} to my watchlist', (title: string) => {
  cy.get(`button[aria-label="Add ${title} to watchlist"]`).click()
})

When('I search the watchlist for {string}', (search: string) => {
  cy.get('[aria-label="Search movies"]').type(search)
})

When('I clear the movie search', () => {
  cy.get('[aria-label="Search movies"]').clear()
})

When('I apply filters to the watchlist', () => {
  cy.contains('button', 'Apply filters').click()
})

When('I clear filters in the watchlist', () => {
  cy.contains('button', 'Clear filters').click()
})

When('I sort the watchlist by {string} in {string} order', (sort: string, order: string) => {
  cy.get('[aria-label="Sort films"]').select(sort).should('have.value', sort)
  cy.get('[aria-label="Sort direction"]').select(order).should('have.value', order)
})

When('I open the watchlist', () => {
  cy.get('button.nav-link').contains('Watchlist').then(($button) => {
    if (!$button.hasClass('active')) cy.wrap($button).click()
  })
})

When('I return to movie discovery', () => {
  cy.contains('a.nav-link', 'Discover').click()
})

When('I open the signed-in account menu', () => {
  cy.get('button[aria-label="Account menu for Jane Doe"]').click()
})

When('I open the first account menu', () => {
  cy.get('button[aria-label="Account menu for Jane Doe"]').click()
})

When('I open the second account menu', () => {
  cy.get('button[aria-label="Account menu for Alex Lee"]').click()
})

When('I log out', () => {
  cy.get('button.account-action').contains('Log out').click()
  cy.wait('@logoutUser')
})

When('I reload and reopen the watchlist', () => {
  cy.reload()
  cy.wait('@getMovies')
  cy.get('button').contains('Watchlist').click()
})

When('I open the login menu', () => {
  cy.get('button[aria-label="Open login menu"]').click()
})

When('I go to the next watchlist page', () => {
  cy.get('button').contains('Next').click()
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
  cy.get('input[autocomplete="email"]').then(($email) => {
    if (!$email.val()) cy.wrap($email).type('jane@example.com')
  })
  cy.get('input[autocomplete="current-password"]').type('correct-password')
  cy.contains('button.account-action', 'Log in').click()
  cy.wait('@loginUser').then(({ request }) => {
    expect(request.body).to.deep.equal({ email: 'jane@example.com', password: 'correct-password' })
  })
})

When('I log in as {string} with password {string}', (email: string, password: string) => {
  cy.get('body').then(($body) => {
    if (!$body.find('.account-form').length) {
      cy.get('button[aria-label="Open login menu"]').click()
    }
  })
  cy.get('input[autocomplete="email"]').clear().type(email)
  cy.get('input[autocomplete="current-password"]').clear().type(password)
  cy.contains('button.account-action', 'Log in').click()
  cy.wait('@isolatedLogin').then(({ request }) => {
    expect(request.body).to.deep.equal({ email, password })
  })
  cy.get('button[aria-label^="Account menu for"]').should('be.visible')
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

Then('the movie request should include search {string}', (search: string) => {
  cy.get('@getMovies.all').should((requests) => {
    expect(requests[requests.length - 1].request.query.search).to.equal(search)
  })
})

Then('the movie request should include genres {string}', (genres: string) => {
  cy.get('@getMovies.all').should((requests) => {
    expect(requests[requests.length - 1].request.query.genres).to.equal(genres)
  })
})

Then('the advanced movie request should include:', (dataTable: { hashes(): Array<{ field: string; value: string }> }) => {
  const expected = dataTable.hashes()
  cy.get('@getMovies.all').should((requests) => {
    const request = requests[requests.length - 1].request
    expected.forEach(({ field, value }) => {
      expect(request.query[field]).to.equal(value)
    })
  })
})

Then('the movie request should use sort {string} and order {string}', (sort: string, order: string) => {
  cy.get('@getMovies.all').should((requests) => {
    const request = requests[requests.length - 1].request
    expect(request.query.sort).to.equal(sort)
    expect(request.query.order).to.equal(order)
  })
})

Then('sorting should include all available fields {string}', (sortFields: string) => {
  const expected = sortFields.split(',')
  cy.get('[aria-label="Sort films"] option').then(($options) => {
    const available = [...$options].map((option) => option.getAttribute('value'))
    expect(available).to.include.members(expected)
  })
})

Then('the catalog heading should remain {string}', (heading: string) => {
  cy.get('.catalog-heading h2').should('have.text', heading)
})

Then('the movie {string} should appear before {string}', (firstTitle: string, secondTitle: string) => {
  cy.get('.movie-card .movie-title').should(($titles) => {
    const titles = [...$titles].map((element) => element.textContent?.trim())
    expect(titles.indexOf(firstTitle)).to.be.lessThan(titles.indexOf(secondTitle))
  })
})

Then('advanced filters should be cleared', () => {
  cy.contains('Advanced filters applied').should('not.exist')
})

Then('I should see the year range validation error', () => {
  cy.get('[role="alert"]').should('contain.text', 'Minimum year must be no greater than maximum year.')
})

Then('no advanced movie request should be sent', () => {
  cy.get<number>('@movieRequestCountBeforeSubmit').then((count) => {
    cy.get('@getMovies.all').should('have.length', count)
  })
})

Then('my watchlist should be empty', () => {
  cy.contains('strong', 'Your watchlist is empty').should('be.visible')
})

Then('my watchlist should contain {string}', (title: string) => {
  cy.contains('.movie-card .movie-title', title).should('be.visible')
})

Then('my watchlist should not contain {string}', (title: string) => {
  cy.contains('.movie-card .movie-title', title).should('not.exist')
})

Then('the guest and both account watchlists should remain separate', () => {
  cy.window().then(({ localStorage }) => {
    expect(JSON.parse(localStorage.getItem('mosaic.watchlist.v1.guest') ?? 'null'))
      .to.deep.equal(['movie-quiet-between'])
    expect(JSON.parse(localStorage.getItem('mosaic.watchlist.v1.user.user-1') ?? 'null'))
      .to.deep.equal(['movie-after-orchard'])
    expect(JSON.parse(localStorage.getItem('mosaic.watchlist.v1.user.user-2') ?? 'null'))
      .to.deep.equal(['movie-distant-voice'])
  })
})

Then('I should see watchlist page {string}', (page: string) => {
  cy.contains(`Page ${page}`).should('be.visible')
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
