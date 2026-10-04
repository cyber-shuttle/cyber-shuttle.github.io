---
title: Project and funding
description: Cybershuttle's NSF awards, stated objectives, team, publications and lineage, with the sources for each fact.
---

# Project and funding

Cybershuttle is funded by the U.S. National Science Foundation (NSF) as a collaborative Frameworks project of the
Cyberinfrastructure for Sustained Scientific Innovation (CSSI) program, in the Office of Advanced Cyberinfrastructure
(OAC) of the CISE directorate. All four awards carry the same title [R1–R4]:

> Collaborative Research: Frameworks: Cybershuttle: An end-to-end Cyberinfrastructure Continuum to accelerate
> Discovery in Science and Engineering

Sources are cited in brackets and listed under [References](#references).

## NSF awards

All four awards started on 2022-09-15 under program officer Wen-Wen Tung, program element 8004 [R1–R4].

| Award | Institution | PI | Co-PIs |
|---|---|---|---|
| [OAC-2209872](https://www.nsf.gov/awardsearch/show-award/?AWD_ID=2209872) (lead) | Indiana University | Suresh Marru | Beth A. Plale and Marlon E. Pierce (both former) |
| [OAC-2209873](https://www.nsf.gov/awardsearch/show-award/?AWD_ID=2209873) | Allen Institute | Anton Arkhipov | None |
| [OAC-2209874](https://www.nsf.gov/awardsearch/show-award/?AWD_ID=2209874) | University of California San Diego | Shava Smallen; Giri Prashanth Krishnan (former) | Maksim Bazhenov, Amitava Majumdar |
| [OAC-2209875](https://www.nsf.gov/awardsearch/show-award/?AWD_ID=2209875) | University of Illinois Urbana-Champaign | Emad Tajkhorshid | James A. Basney, Seid Koric |

| Award | Ends | Estimated total | Obligated |
|---|---|---|---|
| OAC-2209872 | 2028-08-31 | $2,161,272 | $2,361,249 |
| OAC-2209873 | 2027-08-31 | $488,725 | $488,725 |
| OAC-2209874 | 2027-08-31 | $750,000 | $750,000 |
| OAC-2209875 | 2027-08-31 | $1,600,001 | $1,600,001 |

The estimated totals sum to $4,999,998; the lead award's obligation includes a further $199,977 in fiscal year 2023.

Two later NSF awards name Cybershuttle in their abstracts [R5]:

| Award | Institution | Use of Cybershuttle |
|---|---|---|
| VizFold, [2502793](https://www.nsf.gov/awardsearch/show-award/?AWD_ID=2502793) | Georgia Tech | An interactive science gateway powered by Cybershuttle |
| AMOS, [2311928](https://www.nsf.gov/awardsearch/show-award/?AWD_ID=2311928) | University of Colorado Denver | The Apache Airavata ecosystem, with Cybershuttle's developments, to deploy the framework's programs |

## Objectives

Summarised from the award abstract [R1]:

- A research environment that integrates a scientist's tools and data across their own machine, commercial clouds and
  university computing resources, and lets them share work with collaborators for replicability and reuse.
- A hybrid distributed system based on Apache Airavata, in which agent programs deployed on the resources work with
  centrally hosted middleware across local, university, cloud and NSF national computing resources.
- Grounding in three research problems: how viral spike proteins work, how the brain functions during sleep, and how
  machine learning can model engineering materials.
- A spiral development method that starts with scientists on the project team and extends to larger communities,
  guided by a stakeholder advisory board.
- Training of students in open-source software development and applied distributed systems.

## Research codes, resources and events

The project team includes biophysicists, neuroscientists and engineers. Codes used with Cybershuttle include:

| Area | Codes |
|---|---|
| Neuroscience | Allen Institute V1 cortex model, Brain Modeling Toolkit (BMTK), whole-brain sleep model |
| Chemistry, materials and structural biology | QCArchive and Psi4, MatterTune, AMBER, OpenFold and VizFold |
| Physics and engineering | Gkeyll, FEniCS, MFC |

The project also reports these computing resources and public events [R7, R8, R10]:

| Kind | Examples |
|---|---|
| Computing resources | NCSA Delta, Jetstream2, AWS, and the ACCESS clusters listed under [CS Bridge](/vscode/architecture#tested-clusters) |
| Events | ACCESS Support webinar (2025-04-04), NeuroData25 (2025-04-11), CISSE25 workshop (2025-05-07) |

## Lineage

Publications from before 2025 describe earlier software of the project, not the components documented here.

| Year | Work |
|---|---|
| 2023 | The PEARC '23 paper sets out the architecture of agents on the resources plus central middleware on Apache Airavata [R6]; Airavata design notes describe the first agent lifecycle management [R13] |
| 2024 | The Cybershuttle Notebook Gateway extends JupyterLab to provision and connect remote HPC kernels [R11] |
| 2025 | Jupyter magics run notebook cells on remote HPC resources (`airavata-jupyter-magic`) [R14, R15]; the cybershuttle.org research catalog [R9] |
| Current | The components documented here: Apache Airavata as the middleware, [Linkspan](/batch/linkspan-architecture) as the agent, [CS Bridge](/vscode/architecture) and [CS Jupyter](/jupyter/architecture) as clients, and Apache Airavata Custos as the security component; see [Architecture](./architecture.md) |

## Publications

1. S. Marru, M. Pierce, B. Plale, S. Pamidighantam, D. Wannipurage, M. Christie, I. Ranawaka, E. Abeysinghe, R. Quick,
   E. Tajkhorshid, S. Koric, J. Basney, M. Spivak, B. Isralewitz, R. Bernardi, D. Gomes, G. Krishnan, M. Bazhenov,
   S. Smallen, A. Majumdar, A. Arkhipov, K. Dai, X.-P. Liu, K. Yoshimoto. "Cybershuttle: An End-to-End
   Cyberinfrastructure Continuum to Accelerate Discovery in Science and Engineering." *PEARC '23*, Portland, OR,
   2023, pp. 26–34. [doi:10.1145/3569951.3593602](https://doi.org/10.1145/3569951.3593602) [R6]
2. Y. Jayawardana, D. Wannipurage, E. Abeysinghe, S. Marru. "Enhancing Research Productivity: Seamless Integration of
   Personal Devices and HPC Resources with the Cybershuttle Notebook Gateway." *PEARC '24*, Providence, RI, 2024,
   article 41. [doi:10.1145/3626203.3670623](https://doi.org/10.1145/3626203.3670623) [R11]
3. Poster: "Cybershuttle: Advancing Science through a Computing Continuum." 2024 NSF CSSI-CyberTraining-SCIPE PI
   Meeting, Charlotte, NC [R12].
4. Webinar: S. Pamidighantam, K. Cahill. "Computing continuum extension to Science and Engineering Gateways through
   Cybershuttle." ACCESS Support, 2025-04-04 [R10].

## Citation and acknowledgment

BibTeX for the PEARC '23 paper, publication 1 above:

```bibtex
@inproceedings{marru2023cybershuttle,
  title     = {Cybershuttle: An End-to-End Cyberinfrastructure Continuum to Accelerate Discovery in Science and Engineering},
  author    = {Marru, Suresh and Pierce, Marlon and Plale, Beth and others},
  booktitle = {Practice and Experience in Advanced Research Computing (PEARC '23)},
  pages     = {26--34},
  year      = {2023},
  publisher = {ACM},
  doi       = {10.1145/3569951.3593602}
}
```

The NSF acknowledgment for material supported by these awards:

> This material is based upon work supported by the National Science Foundation under Grants No. 2209872, 2209873,
> 2209874 and 2209875. Any opinions, findings, and conclusions or recommendations expressed in this material are
> those of the authors and do not necessarily reflect the views of the National Science Foundation.

## References

All links were captured on 2026-09-29.

| # | Source |
|---|---|
| R1 | [NSF award 2209872](https://www.nsf.gov/awardsearch/show-award/?AWD_ID=2209872) |
| R2 | [NSF award 2209873](https://www.nsf.gov/awardsearch/show-award/?AWD_ID=2209873) |
| R3 | [NSF award 2209874](https://www.nsf.gov/awardsearch/show-award/?AWD_ID=2209874) |
| R4 | [NSF award 2209875](https://www.nsf.gov/awardsearch/show-award/?AWD_ID=2209875) |
| R5 | [NSF awards API search for "Cybershuttle"](https://api.nsf.gov/services/v1/awards.json?keyword=Cybershuttle) |
| R6 | [PEARC '23 paper](https://dl.acm.org/doi/10.1145/3569951.3593602) |
| R7 | [cyber-shuttle GitHub organisation profile](https://github.com/cyber-shuttle) |
| R8 | [Cybershuttle FAQ, Gkeyll gateway](https://vlab.plasmascience.scigap.org/documentation/csFAQ-aug-2025/) |
| R9 | [Cybershuttle research catalog](https://cybershuttle.org) |
| R10 | [ACCESS Support event 7856](https://support.access-ci.org/events/7856) |
| R11 | [PEARC '24 paper](https://dl.acm.org/doi/10.1145/3626203.3670623) |
| R12 | [2024 NSF CSSI-CyberTraining-SCIPE PI Meeting report](https://arxiv.org/abs/2507.04171) |
| R13 | [Apache Airavata wiki, Cybershuttle agents](https://cwiki.apache.org/confluence/display/AIRAVATA/Design+and+implementation+of+lifecycle+management+of+the+Cybershuttle+agents) |
| R14 | [AIRAVATA-3952](https://issues.apache.org/jira/browse/AIRAVATA-3952) |
| R15 | [`airavata-jupyter-magic` on PyPI](https://pypi.org/project/airavata-jupyter-magic/) |
