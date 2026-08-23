import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { StudentsService } from './services/students.service';
import { StudentAnalyticsService } from './services/student-analytics.service';
import { StudentRepresentativeService } from './services/student-representative.service';
import { StudentImportService } from './services/student-import.service';
import {
  CreateStudentDto,
  BulkImportStudentsDto,
  UpdateStudentDto,
  UpdateAcademicDto,
  UpdateStudentStatusDto,
  LookupStudentDto,
} from './dto/create-student.dto';
import { StudentQueryDto } from './dto/student-query.dto';
import { StudentStatementQueryDto } from './dto/student-statement-query.dto';
import { StudentStatsQueryDto } from './dto/student-stats-query.dto';
import { StudentReportQueryDto } from './dto/student-report-query.dto';
import { InviteRepresentativeDto } from './dto/student-representative.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserType } from '@prisma/client';

@Controller('students')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudentsController {
  constructor(
    private readonly studentsService: StudentsService,
    private readonly studentAnalyticsService: StudentAnalyticsService,
    private readonly studentRepresentativeService: StudentRepresentativeService,
    private readonly studentImportService: StudentImportService,
  ) {}

  // =========================================================================
  // 1. STUDENT SELF-SERVICE PORTAL ENDPOINTS (§6 PRD v1.0)
  // =========================================================================

  /**
   * Student Self-Service Dashboard (§6.2 PRD v1.0).
   * Accessible by logged-in STUDENT (and supervising AUTHORITY/TEACHER).
   */
  @Get('me/dashboard')
  @Roles(UserType.STUDENT, UserType.AUTHORITY, UserType.TEACHER)
  async getMyDashboard(
    @CurrentUser('id') personId: string,
    @CurrentUser('userId') userId: string,
  ) {
    const identifier = personId || userId;
    return this.studentAnalyticsService.getStudentDashboard(identifier);
  }

  /**
   * Student Statement / Activity Movement history (§6.3 PRD v1.0).
   * Returns paginated tabular activity data with running balances and PYME resolution.
   */
  @Get('me/statement')
  @Roles(UserType.STUDENT, UserType.AUTHORITY, UserType.TEACHER)
  async getMyStatement(
    @CurrentUser('id') personId: string,
    @CurrentUser('userId') userId: string,
    @Query() query: StudentStatementQueryDto,
  ) {
    const identifier = personId || userId;
    return this.studentAnalyticsService.getStudentStatement(identifier, query);
  }

  /**
   * Student Self-Service Spending Analytics & Statistics (§25 PRD / prompt).
   * Computed strictly from double-entry General Ledger.
   */
  @Get('me/statistics')
  @Roles(UserType.STUDENT, UserType.AUTHORITY, UserType.TEACHER)
  async getMyStatistics(
    @CurrentUser('id') personId: string,
    @CurrentUser('userId') userId: string,
    @Query() query: StudentStatsQueryDto,
  ) {
    const identifier = personId || userId;
    return this.studentAnalyticsService.getStudentStatistics(identifier, query);
  }

  /**
   * Student Structured Financial Certificate / Statement Report (§24 PRD / prompt).
   */
  @Get('me/reports/summary')
  @Roles(UserType.STUDENT, UserType.AUTHORITY, UserType.TEACHER)
  async getMyReportSummary(
    @CurrentUser('id') personId: string,
    @CurrentUser('userId') userId: string,
    @Query() query: StudentReportQueryDto,
  ) {
    const identifier = personId || userId;
    return this.studentAnalyticsService.getStudentReport(identifier, query);
  }

  /**
   * Student Self-Service Profile.
   */
  @Get('me/profile')
  @Roles(UserType.STUDENT, UserType.AUTHORITY, UserType.TEACHER)
  async getMyProfile(
    @CurrentUser('id') personId: string,
    @CurrentUser('userId') userId: string,
  ) {
    const identifier = personId || userId;
    return this.studentsService.getStudentProfile(identifier);
  }

  /**
   * Retrieves student's linked representative info or pending invitation status (§3.4 PRD).
   */
  @Get('me/representative')
  @Roles(UserType.STUDENT, UserType.AUTHORITY, UserType.TEACHER)
  async getMyRepresentative(
    @CurrentUser('id') personId: string,
    @CurrentUser('userId') userId: string,
  ) {
    const identifier = personId || userId;
    return this.studentRepresentativeService.getStudentRepresentative(
      identifier,
    );
  }

  /**
   * Generates a single-use parent cryptographic invitation (§3.4 PRD).
   * Enforces strict One-Representative invariant.
   */
  @Post('me/representative/invite')
  @Roles(UserType.STUDENT, UserType.AUTHORITY)
  @HttpCode(HttpStatus.CREATED)
  async inviteMyRepresentative(
    @CurrentUser('id') personId: string,
    @CurrentUser('userId') userId: string,
    @Body() dto: InviteRepresentativeDto,
  ) {
    const identifier = personId || userId;
    return this.studentRepresentativeService.createRepresentativeInvitation(
      identifier,
      dto,
      personId || userId,
    );
  }

  // =========================================================================
  // 2. CASHIER POS STUDENT LOOKUP (§8 & §9 PRD v1.0)
  // =========================================================================

  /**
   * POS cashier lookup by institutional code or email.
   * Restricted to staff members and authorities.
   */
  @Get('lookup')
  @Roles(UserType.AUTHORITY, UserType.TEACHER)
  async lookupStudent(@Query() query: LookupStudentDto) {
    return this.studentsService.lookupStudent(query);
  }

  // =========================================================================
  // 3. INSTITUTIONAL SUPERVISION & ADMINISTRATIVE ENDPOINTS (§3 & §5 PRD)
  // =========================================================================

  /**
   * Registers a single student.
   * Restricted to AUTHORITY and TEACHER roles.
   */
  @Post()
  @Roles(UserType.AUTHORITY, UserType.TEACHER)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createStudentDto: CreateStudentDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.studentsService.createStudent(createStudentDto, actorId);
  }

  /**
   * Bulk imports students from JSON payload.
   * Restricted to AUTHORITY role.
   */
  @Post('import')
  @Roles(UserType.AUTHORITY)
  @HttpCode(HttpStatus.OK)
  async bulkImport(
    @Body() bulkImportDto: BulkImportStudentsDto,
    @CurrentUser('id') actorId: string,
  ) {
    return this.studentImportService.bulkImport(bulkImportDto, actorId);
  }

  /**
   * Lists all students with pagination and filtering.
   * Restricted to AUTHORITY and TEACHER roles.
   */
  @Get()
  @Roles(UserType.AUTHORITY, UserType.TEACHER)
  async findAll(@Query() query: StudentQueryDto) {
    return this.studentsService.findAll(query);
  }

  /**
   * Retrieves single student details by ID.
   * Restricted to AUTHORITY and TEACHER roles.
   */
  @Get(':id')
  @Roles(UserType.AUTHORITY, UserType.TEACHER)
  async findOne(
    @Param('id') id: string,
    @CurrentUser('institutionalPerson') actor: Record<string, unknown>,
  ) {
    return this.studentsService.findById(id, actor as never);
  }

  /**
   * Supervisory view of student dashboard.
   */
  @Get(':id/dashboard')
  @Roles(UserType.AUTHORITY, UserType.TEACHER)
  async getStudentDashboardById(
    @Param('id') id: string,
    @CurrentUser('institutionalPerson') actor: Record<string, unknown>,
  ) {
    return this.studentAnalyticsService.getStudentDashboard(id, actor);
  }

  /**
   * Supervisory view of student statement / movements.
   */
  @Get(':id/statement')
  @Roles(UserType.AUTHORITY, UserType.TEACHER)
  async getStudentStatementById(
    @Param('id') id: string,
    @Query() query: StudentStatementQueryDto,
    @CurrentUser('institutionalPerson') actor: Record<string, unknown>,
  ) {
    return this.studentAnalyticsService.getStudentStatement(id, query, actor);
  }

  /**
   * Supervisory view of student spending statistics.
   */
  @Get(':id/statistics')
  @Roles(UserType.AUTHORITY, UserType.TEACHER)
  async getStudentStatisticsById(
    @Param('id') id: string,
    @Query() query: StudentStatsQueryDto,
    @CurrentUser('institutionalPerson') actor: Record<string, unknown>,
  ) {
    return this.studentAnalyticsService.getStudentStatistics(id, query, actor);
  }

  /**
   * Supervisory generation of structured financial report for student.
   */
  @Get(':id/reports/summary')
  @Roles(UserType.AUTHORITY, UserType.TEACHER)
  async getStudentReportById(
    @Param('id') id: string,
    @Query() query: StudentReportQueryDto,
    @CurrentUser('institutionalPerson') actor: Record<string, unknown>,
  ) {
    return this.studentAnalyticsService.getStudentReport(id, query, actor);
  }

  /**
   * Supervisory query of student representative.
   */
  @Get(':id/representative')
  @Roles(UserType.AUTHORITY, UserType.TEACHER)
  async getStudentRepresentativeById(@Param('id') id: string) {
    return this.studentRepresentativeService.getStudentRepresentative(id);
  }

  /**
   * Updates student information safely.
   * Restricted to AUTHORITY and TEACHER roles.
   */
  @Patch(':id')
  @Roles(UserType.AUTHORITY, UserType.TEACHER)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateStudentDto,
    @CurrentUser('id') actorId: string,
    @CurrentUser('institutionalPerson') actor: Record<string, unknown>,
  ) {
    return this.studentsService.updateStudent(id, dto, actorId, actor as never);
  }

  /**
   * Dedicated academic update (Course, Tutor, Academic Year) (§10 PRD v1.0).
   * Restricted to AUTHORITY and TEACHER roles.
   */
  @Patch(':id/academic')
  @Roles(UserType.AUTHORITY, UserType.TEACHER)
  async updateAcademic(
    @Param('id') id: string,
    @Body() dto: UpdateAcademicDto,
    @CurrentUser('id') actorId: string,
    @CurrentUser('institutionalPerson') actor: Record<string, unknown>,
  ) {
    return this.studentsService.updateAcademicData(
      id,
      dto,
      actorId,
      actor as never,
    );
  }

  /**
   * Updates student status (ACTIVE / INACTIVE / SUSPENDED).
   * Restricted to AUTHORITY role.
   */
  @Patch(':id/status')
  @Roles(UserType.AUTHORITY)
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStudentStatusDto,
    @CurrentUser('id') actorId: string,
    @CurrentUser('institutionalPerson') actor: Record<string, unknown>,
  ) {
    return this.studentsService.updateStatus(id, dto, actorId, actor as never);
  }

  /**
   * Unlinks representative from a student.
   * Restricted to AUTHORITY role.
   */
  @Delete(':id/representative')
  @Roles(UserType.AUTHORITY)
  async unlinkRepresentative(
    @Param('id') id: string,
    @CurrentUser('id') actorId: string,
  ) {
    return this.studentRepresentativeService.unlinkRepresentative(id, actorId);
  }
}
