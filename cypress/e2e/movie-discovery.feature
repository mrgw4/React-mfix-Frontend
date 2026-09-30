Feature: Movie discovery

  Scenario: Search the preview collection by title
    Given the movie catalog is available
    When I visit the movie discovery page
    And I search for "Quiet Between"
    Then I should see the movie "The Quiet Between"
    And I should not see the movie "After the Orchard"