context('Web Page Status', () => {
  beforeEach(() => {
    cy.visit('http://localhost:1234');
  });

  it('happy test case', () => {
    cy.get('button').click();

    cy.wait(10000);

    cy.contains('Deposit Address');
  });
});
