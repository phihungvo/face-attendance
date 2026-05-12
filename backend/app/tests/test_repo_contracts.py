from __future__ import annotations

import unittest


class TestRepositoryContracts(unittest.TestCase):
    def test_work_schedule_registration_repo_has_list_approved_in_range(self) -> None:
        # Contract test: AttendanceService.stats relies on this repository method.
        from app.repositories.schedules import WorkScheduleRegistrationRepository

        repo = WorkScheduleRegistrationRepository()
        self.assertTrue(hasattr(repo, "list_approved_in_range"))
