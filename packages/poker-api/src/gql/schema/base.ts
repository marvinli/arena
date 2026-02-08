export const baseTypeDefs = /* GraphQL */ `
  type Query {
    _empty: String
  }

  type Mutation {
    _empty: String
  }

  type Card {
    rank: String!
    suit: String!
  }

  type Pot {
    size: Int!
    eligiblePlayerIds: [ID!]!
  }
`;
