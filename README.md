## Componenets
Anchor framework is being used for developing these contracts. Make sure you have that installed.

1. Run local validator with `solana-test-validator` command from SOL CLI tools
2. Run `anchor build`
3. Run `anchor test --skip-local-validator` to run tests


## Contract functions

formatting:
### function_name
(argument_1, argument_2)
- account_1
- account_2

### create_orgniazation
(name, weights, range)
- authority signer
- org account
- org mint


### register
- org mint
- register mint
- applicant signer
- score account

### verify
- org mint
- register mint
- authority signer

### submit_score
(scores)
- org mint
- register mint
- authority signer
