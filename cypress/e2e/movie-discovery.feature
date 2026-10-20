Feature: Movie discovery and account access

  Scenario: Search the movie catalog by title
    Given the movie catalog is available
    When I visit the movie discovery page
    And I search for "Quiet Between"
    Then I should see the movie "The Quiet Between"
    And I should not see the movie "After the Orchard"

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
