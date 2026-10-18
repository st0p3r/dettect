# DeTT&CT User Guide

This guide covers every part of the DeTT&CT web interface: what each section does, the types of files and scores it uses, and the scenarios where it helps. If you're new, read the sections in order. If you're looking for something specific, use the table of contents. A Persian version of this guide is available in [guide-fa.md](guide-fa.md).

## Contents

1. [What is DeTT&CT and what is it for?](#1-what-is-dettct-and-what-is-it-for)
2. [Core concepts](#2-core-concepts)
3. [Installation, running and first steps](#3-installation-running-and-first-steps)
4. [Getting around the web interface](#4-getting-around-the-web-interface)
5. [Dashboard and coverage](#5-dashboard)
6. [Files](#6-files)
7. [Data sources editor](#7-data-sources-editor)
8. [Techniques editor](#8-techniques-editor)
9. [Groups editor](#9-groups-editor)
10. [Data source mapping](#10-data-source-mapping)
11. [Visibility and Detection coverage](#11-visibility-and-detection-coverage)
12. [Threat groups](#12-threat-groups)
13. [ATT&CK statistics](#13-attck-statistics)
14. [Jobs, output and the ATT&CK Navigator](#14-jobs-output-and-the-attck-navigator)
15. [Searching with EQL](#15-searching-with-eql)
16. [Settings](#16-settings)
17. [Use cases](#17-use-cases)
18. [Troubleshooting](#18-troubleshooting)
19. [Appendix: command line equivalents](#19-appendix-command-line-equivalents)

---

## 1. What is DeTT&CT and what is it for?

DeTT&CT (*Detect Tactics, Techniques & Combat Threats*) is a tool for blue teams and SOCs. It answers these questions:

- **What can we see?** Which logs and data sources do we have, and how good is their quality?
- **What can we detect?** Which attack techniques do we have detections for, and how good are they?
- **Where are our gaps?** Which techniques used by real attackers can we neither see nor detect?
- **How much have we improved over time?**

Everything is based on the **MITRE ATT&CK** framework. Results come as **heat maps** for the ATT&CK Navigator, Excel files and graphs.

**The overall flow:**

```
Data sources ──► Visibility scores ──► Detection scores ──► Compare with threat groups
     │                 │                      │                         │
 data quality    what we can see       what we can detect        where our gaps are
```

---

## 2. Core concepts

### MITRE ATT&CK
ATT&CK is a knowledge base of adversary behaviour. It consists of:

| Concept | Description | Example |
|---|---|---|
| **Tactic** | The adversary's goal in a stage of the attack | Credential Access |
| **Technique** | A method used to reach that goal | `T1003` OS Credential Dumping |
| **Sub-technique** | A more specific variant of a technique | `T1003.001` LSASS Memory |
| **Group** | A known threat actor group | `G0016` APT29 |
| **Campaign** | A specific operation | `C0024` SolarWinds Compromise |
| **Software** | Malware or tools used by groups | `S0002` Mimikatz |
| **Data source** | The type of data needed to see a technique | Process Creation |

### Domains
ATT&CK has three domains, and every DeTT&CT file belongs to one of them:

| Domain | Use |
|---|---|
| `enterprise-attack` | Enterprise networks and systems: Windows, Linux, macOS, cloud, containers, etc. (most common) |
| `ics-attack` | Industrial control systems (SCADA, PLCs, etc.) |
| `mobile-attack` | Mobile devices (Android and iOS) |

### Platforms
For Enterprise: `Windows`, `Linux`, `macOS`, `PRE`, `Office Suite`, `Identity Provider`, `SaaS`, `IaaS`, `Network Devices`, `Containers`, `ESXi`. The value `all` means every platform.

### The three file types (YAML)
All your information is stored in three types of YAML files:

| File type | `file_type` | What it holds |
|---|---|---|
| Data sources | `data-source-administration` | The data sources you have, per type of system, with quality scores |
| Techniques | `technique-administration` | Visibility and detection scores per technique, including their history |
| Groups | `group-administration` | Your own groups, campaigns or scenarios (e.g. a red team scenario) |

### Visibility vs. Detection
- **Visibility:** do you have the data needed to *see* a technique? For example, if you collect Process Creation logs, you can *see* malicious PowerShell being executed.
- **Detection:** do you have a *rule or alert* that detects the technique and notifies an analyst?

You can't build a detection without visibility. So you first register your data sources, then raise visibility, then build detections.

### Systems and Applicable to
No environment is uniform. You may run an EDR on Windows workstations but have only basic logging on Linux servers. DeTT&CT handles this with two concepts:

- **System:** a "type of system" in your environment with a name of your choice, linked to ATT&CK platforms. For example `Windows workstations` on the Windows platform, or `Linux servers` on Linux.
- **Applicable to:** every data source registration, and every visibility or detection score, states which system(s) it applies to. The value `all` means every system.

**Example:** you register the data source *Process Creation* twice:
- once for `Windows workstations` with the product Sysmon and quality 4,
- once for `Linux servers` with the product auditd and quality 2.

### Score tables

**Data quality** is scored per data source from 0 to 5 on five dimensions:

| Dimension | Question it answers |
|---|---|
| Device completeness | From what share of devices is this data collected? |
| Data field completeness | Are the required fields (e.g. command line, parent process) present? |
| Timeliness | Does the data arrive on time (close to real time)? |
| Consistency | Are fields standardised and consistent (e.g. same naming)? |
| Retention | Is the data kept long enough? |

Values: `0` none, `1` poor, `2` fair, `3` good, `4` very good, `5` excellent. If all dimensions are zero, the data source counts as **disabled**.

**Visibility score** (0 to 4):

| Score | Meaning |
|---|---|
| 0 | None: no data to see this technique |
| 1 | Minimal |
| 2 | Medium |
| 3 | Good |
| 4 | Excellent: all required data is available in good quality |

**Detection score** (-1 to 5):

| Score | Meaning |
|---|---|
| -1 | None: no detection |
| 0 | Forensics / context only: the data is there, but no alerting |
| 1 | Basic |
| 2 | Fair |
| 3 | Good |
| 4 | Very good |
| 5 | Excellent: accurate, low false positives, tested |

**Automatic visibility:** when DeTT&CT generates visibility scores from your data sources, it first looks at how many data sources ATT&CK lists for a technique, then at what percentage of them you have:

| Share of data sources available | Visibility score |
|---|---|
| 0% | 0 |
| 1–49% | 1 |
| 50–74% | 2 |
| 75–99% | 3 |
| 100% | 4 |

These scores are stored with `auto_generated: true`. When you change a score manually, this flag becomes `false`, and DeTT&CT won't change that score in later updates without your approval.

### Score logbook
Every visibility and detection score has a **history**, where each entry has a date, a score and a comment. The "current" score is always the most recent entry. The history lets you show progress over time (the Graph output).

---

## 3. Installation, running and first steps

### Requirements
- Python 3.10 or later
- Git

### Installation

```
git clone https://github.com/st0p3r/dettect.git
cd dettect
python3 -m venv venv
source venv/bin/activate          # on Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Running

```
python dettect.py editor
```

Your browser opens `http://localhost:8080`. Useful options:

| Option | Use |
|---|---|
| `-p 9000` | Run on another port (if 8080 is in use) |
| `--no-browser` | Don't open the browser automatically |
| `--host 0.0.0.0` | Allow access from other computers on the network. **Caution:** the web interface has no authentication, so anyone on the network can access your files. |

To stop, press `Ctrl+C` in the terminal.

### Running with Docker

```
docker build -t dettect .
docker run -p 8080:8080 dettect
```

### First steps after starting
1. **Download the ATT&CK data:** go to **Settings** and click **Download ATT&CK data**. You only need to do this once, and afterwards DeTT&CT works without internet access. Without it, DeTT&CT fetches the data from MITRE's server every time, which may not be reachable.
2. **Add the sample files:** on the **Dashboard**, click **Add sample files** to learn with ready-made data.

### Folders

| Folder | Contents |
|---|---|
| `input/` | Your YAML files ("My files" in the web interface) |
| `output/` | Output: Navigator layers, Excel files, graphs and generated YAML files |
| `stix-data/` | The downloaded ATT&CK data |
| `cache/` | Cache of the ATT&CK data (when using the online server) |
| `sample-data/` | Sample files |

**Important:** the `input/` folder is not part of Git, so back up your own files separately.

---

## 4. Getting around the web interface

The menu on the left has four sections:

| Section | Pages | Use |
|---|---|---|
| **Overview** | Dashboard, Coverage, Files | Overview, coverage dashboard and file management |
| **Administration** | Data sources, Techniques, Groups | Editing the YAML files (data entry) |
| **Analysis** | Data source mapping, Visibility coverage, Detection coverage, Threat groups, ATT&CK statistics | Generating output and analysis |
| **System** | Jobs, Settings | History of runs and settings |

- The moon/sun button at the top switches between dark and light mode.
- Most fields have a **?** icon next to them. Hover over it for a short explanation.
- The web interface also works on mobile (open the menu with the ☰ button).

---

## 5. Dashboard

**What it shows:**
- The number of data source, technique, group and output files. Click a card to go to that section.
- **Workflow:** the four main steps of working with DeTT&CT, with an Edit button to open the editor and an Analyze button to open the analysis page.
- **Recent jobs:** the latest runs and their status.
- The DeTT&CT and ATT&CK versions, and where the ATT&CK data comes from (online or local).
- When you use MITRE's online server, a yellow warning suggests downloading the data.

**Use:** your daily starting point. For new users, the **Add sample files** button is the best way to start.

### 5.1 Coverage dashboard

The **Coverage** page shows, for a technique file, how much of ATT&CK your visibility and detection cover, without generating any output. Select the file at the top. With **Include sub-techniques** off, only parent techniques are counted.

**Scope:** all ATT&CK techniques for the platforms of the file (for ICS: all ICS techniques), from the ATT&CK version set in Settings.

| Part | What it shows |
|---|---|
| **Visibility / Detection coverage** | The share of techniques in scope with a visibility score ≥ 1, and with a detection score ≥ 1. A detection score of 0 (forensics/context only) doesn't count as a detection. |
| **Techniques in scope** | The number of ATT&CK techniques in scope, and how many of them are in your file |
| **Quick wins** | Techniques with visibility ≥ 2 but no detection: the data is there, only a rule is missing |
| **Coverage per tactic** | Per tactic, the percentage with visibility and with detection. The **Table** button shows the same numbers as a table. |
| **Visibility / Detection scores** | How many techniques have each score |
| **Progress over time** | The number of techniques with visibility and detection at the end of each month, based on the dates in the score logbooks. Scores without a date are not included. |
| **Quick wins list** | The quick wins sorted by visibility. **Edit** opens the technique directly in the techniques editor. |

Hover over the bars and the graph to see the exact numbers. Techniques in your file that don't exist in this ATT&CK version (revoked or deprecated) are listed in a yellow warning and not counted.

**Use:** a quick status overview for yourself or management, and a to-do list for the detection engineers (quick wins).

---

## 6. Files

This page has three tabs.

### My files
Your YAML files (the `input/` folder). For each file the type, name, domain, version, size and modification date are shown.

| Action | Description |
|---|---|
| **Upload** | Upload one or more files from your computer. You can also drag and drop files onto the page. |
| **New file** | Create a new empty file of any of the three types |
| 👁 View | View the file's contents |
| ✏️ Edit | Open the file in the matching editor |
| ⬇ Download | Download to your computer |
| ⋯ → Rename | Rename |
| ⋯ → Duplicate | Make a copy. Make a backup copy before big changes. |
| ⋯ → Delete | Delete permanently (can't be undone) |

### Output
Everything DeTT&CT generates:

| Type | Extension | Use |
|---|---|---|
| Navigator layer | `.json` | Heat map for the ATT&CK Navigator |
| Excel | `.xlsx` | Full table for reporting and review |
| Graph | `.html` | Interactive graph of progress over time |
| YAML | `.yaml` | Technique file generated from data sources |

For output YAML files, the **Copy to my files** button copies the file to `input/`, so you can edit it and use it in analyses.

### Samples
Ready-made sample files. **Add to my files** adds them to your files.

---

## 7. Data sources editor

**Purpose:** record which data sources (logs) you have, on which systems, from which products and in what quality.

### The toolbar of all editors
This toolbar is the same in all three editors:

| Button | Use |
|---|---|
| **Open** | Open one of your files, or *Open from computer* to open a file straight from your computer |
| **New** | New file |
| ⬇ | Download the current file (even when not saved) |
| **Save as** | Save under a new name |
| **Save** | Save to My files |
| **Health check** | Let DeTT&CT check the file for errors |
| **Analyze** | Go straight to the analysis page for this file |

- The yellow **unsaved changes** badge means your changes aren't saved. If you try to leave the page, you get a warning.
- If a file has problems when it's opened (e.g. an invalid platform or a missing value), the editor **repairs** it and lists the changes in a yellow box.

### File details
Click **File details** to expand it:
- **Name:** the name of the file. It is also used in the names of layers and output files.
- **ATT&CK domain:** the domain. It can only be changed while the file is empty.
- **Notes:** free text notes.
- **Systems:** the types of systems in your environment. Each system has a name (applicable to) and one or more platforms.
  - Example: `Windows workstations` on Windows, `Linux servers` on Linux, `Cloud` on IaaS and SaaS.
  - When you rename a system, it is renamed in all data sources too.
  - When you remove a system, it is removed from the data sources too.

### The data source list (left)
- **Add data source:** search the ATT&CK data sources. Only data sources that match the platforms of your systems are suggested. The DeTT&CT-specific data sources are included as well, such as `Web [DeTT&CT data source]`, `Email`, `DHCP` and `Internal DNS`.
- **Add all:** adds all data sources that match your platforms at once (with quality zero). This is useful to start a complete assessment, because you then only need to score what you actually have.
- **Search** works on name, system and product.
- A green dot means enabled (quality above zero). A grey dot means disabled.
- Delete with the bin icon. The **Undo** button in the message at the bottom of the page brings it back.

### Data source details (right)
Each data source has one or more **registrations**, each for one or more systems:

| Field | Description |
|---|---|
| **Applicable to** | Which systems this registration applies to. `all` means every system and can't be combined with other values. A value that isn't defined in Systems turns red. |
| **Date registered** | The date of registration in this file |
| **Date connected** | The date the data was connected to your SIEM or data lake. Used in the progress graph. |
| **Data source enabled** | Turning it off sets all quality scores to zero, and turning it on restores the previous values. |
| **Available for data analytics** | Is the data available in a central place (e.g. a SIEM) for analytics and detection? |
| **Products** | The products that provide this data, such as `Sysmon`, `Microsoft Defender for Endpoint` or `auditd` |
| **Comment** | Free text |
| **Data quality** | The five quality dimensions, each 0 to 5 (see the table in section 2) |
| **Custom key-value pairs** | Your own fields, e.g. `owner: SOC-team` or `cost: high`. They can be used in EQL searches too. |

The **Add registration for other system(s)** button adds a new registration for other systems.

**Example:**
> Data source **Process Creation**:
> - Registration 1: Applicable to = `Windows workstations`, Products = `Sysmon`, Date connected = 2024-03-10, quality: 4, 4, 3, 4, 3
> - Registration 2: Applicable to = `Linux servers`, Products = `auditd`, quality: 2, 2, 3, 2, 2

---

## 8. Techniques editor

**Purpose:** record visibility and detection scores per ATT&CK technique, per system, including their history.

### File details
- **Name**, **Domain** and **Notes** work the same as in the data sources editor.
- **Platforms:** the platforms this file covers. Technique suggestions are filtered on these platforms.

**Tip:** you usually don't start a technique file by hand. You generate it from your data sources (section 10, the *Technique administration YAML* output), bring it to your files with **Copy to my files**, and add your detections here.

### The technique list
- **Add technique:** search by ID or name (e.g. `T1059` or `PowerShell`). You can also type an ID manually.
- Each technique shows two badges: **V** for the highest visibility score and **D** for the highest detection score. `D–` means no detection (-1). The badges go from grey (low) to green (high).

### Technique details
At the top you see the technique's ID and name, its platforms and a link to its page on the ATT&CK website. Below that are the **Detection** and **Visibility** sections, each with one or more score objects:

| Field | Description |
|---|---|
| **Applicable to** | Which systems this score applies to. For visibility, `all` can't be combined with other values. A system used in two score objects turns red. |
| **Location** (detection only) | Where the detection lives, e.g. a rule name, SIEM or EDR. A prefix such as `EDR: Rule 1` lets the *Count detections* option group detections. |
| **Comment** | Free text |
| **Current score** | The current score. Changing it updates the most recent logbook entry, and sets today's date if the entry has no date. |
| **Score logbook** | The full score history: date, score, comment and, for visibility, the `auto` switch |
| **New score entry** | Adds a new entry dated today, so the score change is recorded in the history. |
| **Custom key-value pairs** | Your own fields |

**Best practice for recording changes:** when a score improves (e.g. you wrote a new rule), don't change the current score. Click **New score entry** and set the new score in the new entry instead. That way the progress graph is correct.

**Example:**
> Technique **T1003.001 LSASS Memory**:
> - Detection for `Windows workstations`: Location = `EDR: Credential theft rule`, score 4
> - Detection for `Windows servers`: Location = `SIEM: Sysmon EID 10 on lsass`, score 2
> - Visibility for `all`: score 3 (auto_generated)

---

## 9. Groups editor

**Purpose:** define threat groups, campaigns or your own scenarios as a list of techniques and software. Use it when the group you need isn't in ATT&CK, or when you have more specific information.

**Uses:**
- A threat group from your own threat intelligence or regional reports that isn't in ATT&CK
- A red team or penetration test scenario
- A real security incident in your organisation
- A combined "group" of threats relevant to your industry

### Fields
| Field | Description |
|---|---|
| **Group name** | The name of the group |
| **Campaign** | Optional. The combination of group name and campaign must be unique, so one group can have several campaigns. |
| **Enabled** | Only enabled groups are used in analyses. |
| **Techniques** | The list of techniques, with ATT&CK search. At least one technique is required. |
| **Software** | ATT&CK software (e.g. `S0002 Mimikatz`). In the analysis, the techniques of this software can be added too. |
| **Custom key-value pairs** | Your own fields, e.g. the source report |

Select the platforms in **File details**. Suggestions are filtered on them.

---

## 10. Data source mapping

**Input:** a data source file.

### Outputs (you can select several at once)

| Output | What it creates | Use |
|---|---|---|
| **Navigator layer** | A heat map where each technique is coloured by the percentage of available data sources | See which part of ATT&CK your current data sources cover |
| **Excel** | A full list of data sources with details and quality | Reporting, review with the team, finding low-quality data sources |
| **Graph** | The number of connected data sources over time (based on *Date connected*) | Showing progress to management |
| **Technique administration YAML** | A new technique file with automatic visibility scores | **Starting your technique file**. The *Include all ATT&CK techniques* option adds all techniques of the platforms, including those scoring zero. |
| **Update visibility scores** | Updates the visibility scores of an existing technique file based on changes in your data sources | After adding a new data source or an ATT&CK update. A backup (`_backup_N.yaml`) is made before any change. |

**Interactive questions during an update:** DeTT&CT may ask whether you want to add a comment to the new scores, or whether a manual score should be replaced. The question appears in a purple box below the output, and you answer with buttons (Yes, No, Yes to ALL, No to ALL, Continue). For text answers, such as a comment, use the input box at the bottom.

### Filters
- **Only include systems (applicable to):** analyse specific systems only. For example only `Windows workstations`.
- **EQL search:** advanced filter (section 15). For example only data sources from Sysmon.

### Advanced options (on all analysis pages)
| Option | Description |
|---|---|
| Output filename | The name of the output file. Generated automatically when empty. |
| Layer name | The name of the layer in the Navigator |
| Navigator layer settings | Layer display settings: `layout` (side/flat/mini), `showAggregateScores`, `showMetadata`, `includeTactic`, `includeAttackVersion` |
| Overwrite existing output files | Overwrite the previous file instead of creating `_1`, `_2` etc. |
| Show detailed health check errors | Show the details of errors in the file. |

---

## 11. Visibility and Detection coverage

The **Visibility coverage** and **Detection coverage** pages are nearly identical. The **input** for both is a technique file.

### Outputs
| Output | Visibility coverage | Detection coverage |
|---|---|---|
| **Layer** | Map of visibility scores | Map of detection scores |
| **Overlay** | Visibility and detection combined | Detection and visibility combined |
| **Graph** | Visibility progress over time | Detection progress over time |
| **Excel** | All techniques with their scores | All techniques with their scores |

**What does the overlay show?** The colours separate four situations:
- Both visibility and detection: good.
- Visibility but no detection: **an opportunity!** The data is there, you only need to write a rule.
- Detection but no recorded visibility: the file is probably incomplete.
- Neither: a gap.

### Options
- **Platforms:** limit to specific platforms. The default is the platforms in the file.
- **EQL search on visibility / detection:** filter on the scores (section 15).
- **Search all scores in the score logbook:** by default only the most recent score is searched. With this option the whole history is searched.
- **Count detections:** the layer metadata shows the number of detections per prefix (`EDR:`, `SIEM:` etc.) instead of listing all locations.

---

## 12. Threat groups

**Purpose:** create heat maps of threat group behaviour, compare groups with each other, or compare them with your own coverage. This is the most important section for **threat-informed defense**.

### Options
| Option | Description |
|---|---|
| **Groups** | ATT&CK groups by ID, name or alias (e.g. `APT29`, `G0016` or `Cozy Bear`), or your own group file. When no group and no campaign is selected, **all groups** are used. |
| **Campaigns** | ATT&CK campaigns. Complements the groups. |
| **ATT&CK domain** | The domain. Ignored when a group file specifies a domain. |
| **Platforms** | Limit to platforms |
| **Overlay** | Compare with: **Groups** (other groups), **Campaigns**, **Visibility** or **Detection** (a technique file) |
| **Software** | *Ignore*: software is ignored. *Add*: techniques of the software are marked but not counted in the score. *Include*: they are counted in the score too. |

### What does the result mean?
- **Without an overlay:** the score of each technique is the number of groups using it. Darker techniques are more popular among attackers.
- **Overlay with a group:** the colours show whether a technique is used only by the first group, only by the second, or by both.
- **Overlay with visibility or detection:** shows which of this group's techniques you cover and which you don't. This is the **most precise output for prioritisation**.

---

## 13. ATT&CK statistics

General ATT&CK information, independent of your files:

| Option | Output | Use |
|---|---|---|
| **Data source statistics** | Data sources ordered by the number of techniques they cover, filtered on domain and platform | **Prioritising log collection**: the data sources that cover the most techniques are the most valuable. |
| **Mitigation statistics** | Mitigations ordered by the number of techniques | Prioritising preventive measures (hardening) |
| **List platforms** | The platforms of each domain | Reference |
| **ATT&CK updates** | Techniques, groups or software ordered by creation or modification date | Following ATT&CK changes and reviewing the affected detections |

The result is shown in the console.

---

## 14. Jobs, output and the ATT&CK Navigator

### Jobs
Every analysis is a **job**. The job panel contains:
- **Status:** Queued, Running, Finished, Failed or Cancelled. Jobs run one at a time.
- The equivalent **command line**, with a copy button
- A **console** with live output
- **Questions** with answer buttons
- A **Stop** button
- **Created / changed files:** the files that were created or changed, with View, Navigator, Download and Copy to my files buttons

The **Jobs** page keeps the history of all runs until DeTT&CT is restarted.

### Viewing layers
**In DeTT&CT (View):** a quick preview of the heat map, with a legend and the number of techniques per colour. Hover over a technique to see its details. The JSON tab shows the raw content of the layer.

**ATT&CK Navigator (Navigator button):** opens the full ATT&CK matrix on MITRE's website.
- Your browser may ask for permission to access your "local network" or "apps on this device". You need to click **Allow**.
- If that doesn't work, download the file and open it in the Navigator via **Open Existing Layer → Upload from local**.
- In the Navigator you can combine layers, export to an image or Excel, and filter.

**Graph:** the interactive graph is shown inside the page.

---

## 15. Searching with EQL

EQL (Event Query Language) is an advanced filter that works in three places. Each has its own structure.

### Data sources (on the Data source mapping page)
Structure: `data_sources where <condition>`

Available fields: `data_source_name`, `applicable_to`, `products`, `available_for_data_analytics`, `comment`, `data_quality.device_completeness`, `data_quality.data_field_completeness`, `data_quality.timeliness`, `data_quality.consistency`, `data_quality.retention` and your own custom fields.

```
data_sources where arrayContains(products, "Sysmon")
data_sources where available_for_data_analytics == true
data_sources where data_quality.device_completeness >= 3
data_sources where data_source_name == "Process*"
data_sources where applicable_to == "Windows workstations"
```

### Visibility and detection (on the coverage and threat group pages)
Structure: `techniques where <condition>`

Fields: `technique_id`, `technique_name`, and for visibility: `visibility.applicable_to`, `visibility.comment`, `visibility.score_logbook.score`, `visibility.score_logbook.date`, `visibility.score_logbook.comment`, `visibility.score_logbook.auto_generated`. For detection the same fields with `detection.` instead of `visibility.`, plus `detection.location`.

```
techniques where visibility.score_logbook.score >= 3
techniques where detection.score_logbook.score >= 2
techniques where arrayContains(detection.location, "EDR")
techniques where arraySearch(detection.location, loc, loc == "Splunk*")
techniques where detection.score_logbook.date >= "2024-01-01"
techniques where technique_id == "T1003*"
techniques where arrayContains(visibility.applicable_to, "all")
```

**Tips:**
- `*` matches any text. For example `"T1003*"` includes all sub-techniques of T1003.
- For list fields (such as `products`, `location` and `applicable_to` in techniques), use `arrayContains`. This function only finds exact values. To search with `*`, use `arraySearch`, e.g. `arraySearch(detection.location, loc, loc == "EDR*")`.
- Combine conditions with `and`, `or` and `not`.
- When a field name is wrong, DeTT&CT shows an error in the console with the list of allowed fields (the schema).
- By default only the most recent score in the history is searched. To search the whole history, turn on the *Search all scores* option.

**Uses:**
- A layer with only EDR detections, to compare with SIEM detections
- A layer with only detections added this year, for an annual report
- Only good visibility (3 and up), to find where you're ready to write rules

---

## 16. Settings

### ATT&CK data source
- **MITRE's TAXII server:** the data is fetched from MITRE's online server and cached for 30 days. Requires access to `attack-taxii.mitre.org`.
- **Local STIX data:** the data is read from files on this computer. Works without internet access, and the ATT&CK version stays fixed. **This option is recommended.**
- **Ignore TLS verification errors:** only when a proxy intercepts TLS traffic and the connection fails with a certificate error. Not recommended for security reasons.

### Download ATT&CK data
Downloads the ATT&CK data (about 65 MB) from GitHub into the `stix-data/` folder and automatically switches the settings to Local. Download it again every few months (after a new ATT&CK release).

### ATT&CK data in the editors and the coverage dashboard
The suggestions in the editors (techniques, software and data sources) and the coverage dashboard use the same ATT&CK data as the analyses. Below the search box of each editor you can see where they come from, e.g. *ATT&CK v19.1 · local data*. The first time this takes a few seconds; after that it is cached. If the ATT&CK data can't be loaded, the editors fall back to a built-in list (*built-in ATT&CK list*).

### Cache
Processed ATT&CK data is cached. If you downloaded new data or results look odd, click **Clear cache**.

### About
The versions of DeTT&CT, ATT&CK and the Navigator, and of the file formats.

---

## 17. Use cases

### Use case 1: initial SOC maturity assessment
**Question:** "What can we currently see and detect?"

1. **Data sources → New.** Define your systems in File details (e.g. Windows workstations, Windows servers, Linux servers, Cloud).
2. Click **Add all** to add all relevant data sources.
3. For each data source you actually have, enter the product, the date connected and the quality. Leave the rest at zero, or delete them.
4. **Save**, then **Analyze**. Generate the **Navigator layer**, **Excel** and **Technique administration YAML** outputs.
5. Bring the generated technique YAML to your files with **Copy to my files**.
6. In **Techniques**, enter detections for the techniques you have rules or use cases for.
7. In **Detection coverage**, generate the **Overlay with visibility** output and view it in the Navigator.

**Result:** a clear picture of the current state that you can present to management.

### Use case 2: gap analysis based on relevant threats
**Question:** "Where are our gaps against the groups that target our industry?"

1. Find the groups relevant to your industry or region in threat intelligence reports.
2. **Threat groups:** add those groups, set the overlay to **Detection** and select your technique file.
3. View the result in the Navigator. The techniques these groups use that you don't detect are your **first priority**.
4. Do the same with the overlay set to **Visibility**. Where you have no visibility either, you need new logs.

### Use case 3: prioritising log collection
**Question:** "Our budget is limited. Which logs should we collect first?"

1. **ATT&CK statistics → Data source statistics** for your platforms. The data sources that cover the most techniques are at the top of the list.
2. Compare that list with the Excel file of your own data sources (section 10).
3. **Combine with threats:** in **Threat groups**, create the layer of the relevant groups and see which data sources their most frequent techniques need (in the Navigator, or on the technique's page on the ATT&CK website).
4. Once a new log is added, register it in **Data sources** and update the technique file with **Update visibility scores**.

### Use case 4: red team and purple team planning
**Question:** "What should our next exercise focus on, and how do we record the result?"

1. **Groups → New:** define the exercise scenario as a group with its techniques (e.g. "Red team – Ransomware scenario").
2. **Threat groups:** select the group from your file and set the overlay to **Detection**. The output predicts which steps of the scenario will probably go undetected.
3. After the exercise, record the actual result in **Techniques**: use **New score entry** with a comment, e.g. "Purple team 2025-Q1: detected by EDR".
4. Add later exercises as new campaigns (the Campaign field) in the same group to keep the history.

### Use case 5: tracking progress and periodic reporting
**Question:** "How much have we improved in the last six months?"

1. Record every score change with **New score entry** and the correct date, instead of changing the previous score.
2. **Detection coverage → Graph** and **Visibility coverage → Graph:** progress over time.
3. **Data source mapping → Graph:** the growth of your data sources (based on Date connected).
4. Use EQL to create a layer with only recent changes: `techniques where detection.score_logbook.date >= "2025-01-01"`.

### Use case 6: comparing environments or tools
**Question:** "How does our EDR coverage compare with our SIEM?" or "Windows vs. Linux?"

- **By tool:** use a prefix in the detection locations (`EDR: ...`, `SIEM: ...`). Then create two layers with EQL and compare them in the Navigator:
  - `techniques where arraySearch(detection.location, loc, loc == "EDR*")`
  - `techniques where arraySearch(detection.location, loc, loc == "SIEM*")`
- **By system:** in Data source mapping, create a separate layer per system with the **Only include systems** filter.

### Use case 7: comparing threat groups
**Question:** "Which techniques do two threat groups have in common?"

**Threat groups:** put the first group in Groups, set the overlay to **Groups** and add the second group in Overlay. Shared techniques get a separate colour. Detections for these techniques protect you against both groups.

### Use case 8: keeping up with ATT&CK
**Question:** "MITRE released a new version. What changed for us?"

1. **Settings → Download ATT&CK data** (the new version), then **Clear cache**.
2. **ATT&CK statistics → ATT&CK updates** for techniques: review the recent changes and the related detections.
3. **Data source mapping → Update visibility scores:** visibility scores are updated based on the ATT&CK changes.
4. Run a **Health check** on your files to find removed or changed techniques.

---

## 18. Troubleshooting

| Problem | Cause and solution |
|---|---|
| `address already in use` | The port is in use. Use `python dettect.py editor -p 9000`. |
| `Cannot connect to MITRE's CTI TAXII server` or a 503 error | MITRE's server can't be reached. Download the data in **Settings** and select Local. |
| The Navigator says `ERROR retrieving layer` | Click **Allow** in the browser's prompt. If you blocked it before, change the permission in the site settings of `mitre-attack.github.io`. Alternatively, download the file and open it in the Navigator with Upload from local. |
| A file doesn't open in the editor and shows a version error | The file version is old. Run a **Health check** on the file (or any analysis). DeTT&CT offers to upgrade it, which you confirm with **Yes**. |
| An EQL error showing the schema | The field name or structure is wrong. See section 15 and the field list in the output. For techniques, use `techniques where`, not `visibility where`. |
| `The search returned 0 ...` | The EQL search had no results. Simplify the condition. |
| A group is missing from the Threat groups suggestions | The ATT&CK data isn't loaded (yellow warning at the top of the page). Check Settings. You can also type the group name manually. |
| Editor changes don't show up in an analysis | **Save** the file. Analyses run on the version saved in My files. |
| A job seems stuck | It's probably waiting for an answer to a question. Look at the bottom of the console, or stop the job with **Stop**. |

---

## 19. Appendix: command line equivalents

Everything you do in the web interface has an equivalent command, shown in the job panel. This is useful for automation (e.g. with cron):

```
# Data sources: layer, Excel, graph and technique YAML
python dettect.py ds -fd input/data-sources.yaml -l -e -g -y

# Update visibility scores
python dettect.py ds -fd input/data-sources.yaml -ft input/techniques.yaml -u

# Visibility: layer and overlay with detection
python dettect.py v -ft input/techniques.yaml -l -o

# Detection: layer, graph and Excel
python dettect.py d -ft input/techniques.yaml -l -g -e

# Groups: APT29 compared with your detections
python dettect.py g -g APT29 -o input/techniques.yaml -t detection

# Data source statistics for Windows
python dettect.py ge -ds enterprise -p Windows

# Health check of a file
python dettect.py v -ft input/techniques.yaml --health

# Use the local ATT&CK data
python dettect.py v -ft input/techniques.yaml -l --local-stix-path stix-data
```

Help for each mode: `python dettect.py <mode> --help`, e.g. `python dettect.py ds --help`.
