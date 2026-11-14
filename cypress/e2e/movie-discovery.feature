Feature: Movie discovery and account access

  Scenario: Search the movie catalog by title
    Given the movie catalog is available
    When I visit the movie discovery page
    And I search for "Quiet Between"
    Then I should see the movie "The Quiet Between"
    And I should not see the movie "After the Orchard"
    And the movie request should include search "Quiet Between"

  Scenario: Filter the catalog by multiple genres
    Given the movie catalog is available
    When I visit the movie discovery page
    And I choose the genres "Drama" and "Mystery"
    Then I should see the movie "The Quiet Between"
    And I should not see the movie "After the Orchard"
    And the movie request should include genres "Drama,Mystery"

  Scenario: Apply and clear advanced movie filters
    Given the movie catalog is available
    When I visit the movie discovery page
    And I open advanced search
    And I set the advanced search field "Title" to "Quiet"
    And I set the advanced search field "Plot" to "story from the backend"
    And I set the advanced search field "Director" to "Mara Ellison"
    And I set the advanced search field "Cast member" to "Nina Park"
    And I set the advanced search field "Content rating" to "PG-13"
    And I set the advanced search field "Movie type" to "movie"
    And I set the advanced search field "Release year from" to "2020"
    And I set the advanced search field "Release year to" to "2025"
    And I set the advanced search field "Minimum runtime" to "100"
    And I set the advanced search field "Maximum runtime" to "115"
    And I set the advanced search field "Minimum IMDb rating" to "8"
    And I set the advanced search field "Maximum IMDb rating" to "9"
    And I set the advanced search field "Minimum Metacritic score" to "80"
    And I set the advanced search field "Maximum Metacritic score" to "95"
    And I apply advanced filters
    Then I should see the movie "The Quiet Between"
    And I should not see the movie "A Distant Voice"
    And the advanced movie request should include:
      | field         | value                    |
      | title         | Quiet                    |
      | plot          | story from the backend   |
      | directors     | Mara Ellison             |
      | cast          | Nina Park                |
      | rated         | PG-13                     |
      | type          | movie                    |
      | yearMin       | 2020                     |
      | yearMax       | 2025                     |
      | runtimeMin    | 100                      |
      | runtimeMax    | 115                      |
      | imdbRatingMin | 8                        |
      | imdbRatingMax | 9                        |
      | metacriticMin | 80                       |
      | metacriticMax | 95                       |
    When I clear advanced filters
    Then advanced filters should be cleared
    And I should see the movie "After the Orchard"
    And I should see the movie "A Distant Voice"

  Scenario: Keep sorting controls and results synchronized
    Given the movie catalog is available
    When I visit the movie discovery page
    And I sort films by "imdbRating" in "asc" order
    Then the movie request should use sort "imdbRating" and order "asc"
    And sorting should include all available fields "year,imdbRating,title,runtime,released,metacritic"
    And the catalog heading should remain "A little of everything"
    And the movie "After the Orchard" should appear before "The Quiet Between"

  Scenario: Reject an inverted advanced-search range
    Given the movie catalog is available
    When I visit the movie discovery page
    And I open advanced search
    And I set the advanced search field "Release year from" to "2025"
    And I set the advanced search field "Release year to" to "2020"
    And I note the current movie request count
    And I apply advanced filters
    Then I should see the year range validation error
    And no advanced movie request should be sent

  Scenario: Keep guest and signed-in watchlists separate
    Given the movie catalog is available
    And the account API is available
    When I visit the movie discovery page
    And I save "The Quiet Between" to my watchlist
    And I open the login menu
    And I log in with the registered credentials
    And I open the watchlist
    Then my watchlist should be empty
    When I return to movie discovery
    And I save "After the Orchard" to my watchlist
    And I open the signed-in account menu
    And I log out
    And I open the watchlist
    Then my watchlist should contain "The Quiet Between"
    And my watchlist should not contain "After the Orchard"
    When I reload and reopen the watchlist
    Then my watchlist should contain "The Quiet Between"
    And my watchlist should not contain "After the Orchard"

  Scenario: Keep guest and multiple user watchlists isolated
    Given the movie catalog is available
    And two distinct accounts are available
    When I visit the movie discovery page
    And I save "The Quiet Between" to my watchlist
    And I open the watchlist
    Then my watchlist should contain "The Quiet Between"
    When I log in as "jane@example.com" with password "correct-password"
    Then my watchlist should be empty
    When I return to movie discovery
    And I save "After the Orchard" to my watchlist
    And I open the watchlist
    Then my watchlist should contain "After the Orchard"
    And my watchlist should not contain "The Quiet Between"
    When I open the first account menu
    And I log out
    Then my watchlist should contain "The Quiet Between"
    And my watchlist should not contain "After the Orchard"
    When I log in as "alex@example.com" with password "correct-password"
    Then my watchlist should be empty
    When I return to movie discovery
    And I save "A Distant Voice" to my watchlist
    And I open the watchlist
    Then my watchlist should contain "A Distant Voice"
    And my watchlist should not contain "The Quiet Between"
    And my watchlist should not contain "After the Orchard"
    And the guest and both account watchlists should remain separate
    When I open the second account menu
    And I log out
    And I log in as "jane@example.com" with password "correct-password"
    And I open the watchlist
    Then my watchlist should contain "After the Orchard"
    And my watchlist should not contain "The Quiet Between"
    And my watchlist should not contain "A Distant Voice"
    When I log out
    And I log in as "alex@example.com" with password "correct-password"
    Then my watchlist should contain "A Distant Voice"
    And my watchlist should not contain "The Quiet Between"
    And my watchlist should not contain "After the Orchard"

  Scenario: Paginate a long watchlist
    Given the movie catalog is available
    And the guest watchlist is preloaded with 31 movies
    When I visit the movie discovery page
    And I open the watchlist
    Then I should see the movie "Film watchlist-0"
    And I should see watchlist page "1 of 2"
    And I should not see the movie "Film watchlist-30"
    When I go to the next watchlist page
    Then I should see the movie "Film watchlist-30"
    And I should see watchlist page "2 of 2"

  Scenario: Filter and sort saved films in the watchlist
    Given the movie catalog is available
    When I visit the movie discovery page
    And I save "The Quiet Between" to my watchlist
    And I save "After the Orchard" to my watchlist
    And I save "A Distant Voice" to my watchlist
    And I open the watchlist
    Then I should see the movie "The Quiet Between"
    And I should see the movie "After the Orchard"
    And I should see the movie "A Distant Voice"
    When I search the watchlist for "Mara Ellison"
    Then I should see the movie "The Quiet Between"
    And I should see the movie "A Distant Voice"
    And I should not see the movie "After the Orchard"
    When I clear the movie search
    And I open advanced search
    And I set the advanced search field "Title" to "Distant"
    And I apply filters to the watchlist
    Then I should see the movie "A Distant Voice"
    And I should not see the movie "The Quiet Between"
    When I clear filters in the watchlist
    And I sort the watchlist by "imdbRating" in "asc" order
    Then the movie "After the Orchard" should appear before "The Quiet Between"

  Scenario: Register and log in with a new account
    Given the movie catalog is available
    And the account API is available
    When I visit the movie discovery page
    And I open the login menu
    And I choose to create an account
    And I register with username "Jane Doe", email "jane@example.com", and password "correct-password"
    Then I should be returned to the login form with a success message
    When I log in with the registered credentials
    Then I should be logged in as "Jane Doe"

  Scenario: Reject registration when the password confirmation does not match
    Given the movie catalog is available
    And the account API is available
    When I visit the movie discovery page
    And I open the login menu
    And I choose to create an account
    And I register with a mismatched password confirmation
    Then I should see a password mismatch error
    And no registration request should be sent

  Scenario: Show a clear error when login is rejected
    Given the movie catalog is available
    And the login API rejects the credentials with an empty response
    When I visit the movie discovery page
    And I open the login menu
    And I log in with invalid credentials
    Then I should see the credential error above the email field
