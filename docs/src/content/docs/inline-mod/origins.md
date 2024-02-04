---
title: Origins
sidebar:
  order: 100
---

This plugin was based on the [work by the Pulumi Corporation][original code] for their inline lambda feature.
[Pulumi](https://pulumi.com) is an Infrastructure as Code platform that allows declaring the desired state of
your infrastructure and construct those declaration using a familiar language like TypeScript, Python or Go.

The original work was strictly for serializing a single exported function along with its captured environment,
and was limited to CommonJS operation mode. This library ports all that logic to ECMAScript Modules and rework
all the logic to support the definition of arbitrary modules.

[original code]: https://github.com/pulumi/pulumi/tree/d4969f3338eb55f8072518ca89ed17a9b72bde93/sdk/nodejs/runtime/closure

Thank you to the authors of the original inline closure serialization code who brought this idea into existence
years ago.

:::tip
Pulumi's product is their management portal for team collaboration and AI solutions,
the IaC engine is entirely open source with no locked features, so you can use it for free forever on personal
projects with no limits by managing the state yourself (which is easy if you don't need to manager permissions
of a team) or on smaller projects in your company for evaluating it.

You only pay once you get big enough that outsourcing their service is preferrable.

Do check them out!
:::
