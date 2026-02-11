import * as cdk from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import type { Construct } from "constructs";

export class AuthStack extends cdk.Stack {
  readonly userPool: cognito.UserPool;
  readonly userPoolClient: cognito.UserPoolClient;
  readonly userPoolDomain: cognito.UserPoolDomain;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.userPool = new cognito.UserPool(this, "AdminUsers", {
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.userPoolDomain = this.userPool.addDomain("Domain", {
      cognitoDomain: { domainPrefix: "arena-admin" },
    });

    // ALB URL is needed for the callback — use a placeholder, update after first deploy
    const callbackUrl = "https://placeholder.example.com";

    this.userPoolClient = this.userPool.addClient("AdminApp", {
      oAuth: {
        flows: { implicitCodeGrant: true },
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL],
        callbackUrls: [callbackUrl, "http://localhost:5174"],
      },
      authFlows: { userSrp: true },
    });

    // ── Outputs ───────────────────────────────────────────
    new cdk.CfnOutput(this, "CognitoDomain", {
      value: `${this.userPoolDomain.domainName}.auth.${this.region}.amazoncognito.com`,
      description: "Cognito Hosted UI domain",
    });

    new cdk.CfnOutput(this, "CognitoClientId", {
      value: this.userPoolClient.userPoolClientId,
      description: "Cognito App Client ID",
    });

    new cdk.CfnOutput(this, "UserPoolId", {
      value: this.userPool.userPoolId,
      description: "Cognito User Pool ID",
    });
  }
}
